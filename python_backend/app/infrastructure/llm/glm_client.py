"""GLM (Z.ai) client. OpenAI-compatible — streams SSE (data: {...}\\n\\n)."""
import json
import logging
from typing import Any, AsyncIterator, List, Optional, Union

import httpx

from app.application.ports.llm_provider import LLMProvider
from app.domain.entities.chat_message import ChatMessage


logger = logging.getLogger(__name__)


# Sentinel — differentiates "caller did not pass reasoning_override"
# (use constructor default) from "caller explicitly passed None"
# (disable reasoning for THIS call). GLM has no per-request reasoning
# knob, but we keep the sentinel for port contract symmetry with
# ``OllamaCloudClient``. Comparison is by identity (``is`` / ``is not``).
class _Unset:
    """Marker type for ``reasoning_override`` default. NOT exported."""

    __slots__ = ()

    def __repr__(self) -> str:  # pragma: no cover — debug aid
        return "<UNSET>"


_UNSET: "_Unset" = _Unset()


class GLMClient(LLMProvider):
    """GLM (Z.ai) OpenAI-compatible client. Streams SSE.

    Key differences vs OpenAI / Groq:
      * GLM emits a ``delta.reasoning_content`` field in stream chunks
        (sister of ``delta.content``). On reasoning-flavoured models
        (glm-4.5-flash answering thoughtful prompts) the entire response
        sometimes lands in ``reasoning_content`` while ``content`` stays
        empty. We buffer ``reasoning_content`` and, if no ``content`` was
        emitted, surface the reasoning buffer as the final answer.
      * No native ``num_predict`` — we use OpenAI's ``max_tokens``.
      * Free tier (``glm-4.5-flash``) is the only model that works
        without a paid plan. Other models (``glm-4.7-flash``, ``glm-5.1``,
        ``glm-4.5-air``) reply HTTP 429 ("Insufficient balance").

    Reasoning override:
      * GLM API has NO per-request reasoning knob. We accept the
        ``reasoning_override`` argument purely for port-contract
        compatibility (so the agent can call any provider uniformly).
        The value is otherwise ignored.
    """

    # Default cap on visible output. Mirrors OllamaCloudClient's
    # DEFAULT_NUM_PREDICT — picked high enough to leave headroom for
    # reasoning-content emission on harder prompts ("definí X", "explicá Y").
    DEFAULT_MAX_TOKENS = 2000

    # Extra ``max_tokens`` headroom reserved when reasoning may be active.
    # GLM doesn't tell us up-front whether the model will emit
    # ``reasoning_content``, so we ALWAYS pad. 600 was picked from the
    # worst-case observed thinking budget on gpt-oss (sister behaviour);
    # GLM's reasoning trace tends to be in the same ballpark.
    REASONING_HEADROOM_TOKENS = 600

    # Hard floor when reasoning is potentially active — even short
    # scenarios need at least this much budget or the reasoning trace
    # will starve content.
    MIN_MAX_TOKENS_WITH_REASONING = 1000

    def __init__(
        self,
        api_key: str,
        model: str = "glm-4.5-flash",
        base_url: str = "https://api.z.ai/api/paas/v4",
        temperature: float = 0.7,
        timeout: float = 60.0,
        reasoning: Optional[str] = None,
    ) -> None:
        # NEVER log this value. Only used in Authorization header.
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.temperature = temperature
        self.timeout = timeout
        # Accepted for port symmetry. GLM has no per-call reasoning knob,
        # so this is informational only — we never put it on the wire.
        self.reasoning = reasoning

    def _build_payload(
        self,
        messages: List[ChatMessage],
        system: Optional[str],
        stream: bool,
        max_tokens: Optional[int] = None,
    ) -> dict:
        """Build the /chat/completions payload (OpenAI shape)."""
        wire_messages: list[dict] = []
        if system:
            wire_messages.append({"role": "system", "content": system})
        for m in messages:
            wire_messages.append({"role": m.role, "content": m.content})
        payload: dict = {
            "model": self.model,
            "messages": wire_messages,
            "temperature": self.temperature,
            "stream": stream,
        }
        # Always set max_tokens with reasoning headroom. We can't tell
        # whether the model will emit reasoning_content for this prompt,
        # so we pad unconditionally — matches the OllamaCloudClient
        # convention (it pads num_predict the same way unless thinking
        # is explicitly disabled, which GLM has no knob for).
        effective_tokens = (
            max_tokens if max_tokens is not None else self.DEFAULT_MAX_TOKENS
        )
        effective_tokens = max(
            effective_tokens + self.REASONING_HEADROOM_TOKENS,
            self.MIN_MAX_TOKENS_WITH_REASONING,
        )
        payload["max_tokens"] = effective_tokens
        return payload

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }

    async def stream(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
        reasoning_override: Union[Optional[str], "_Unset"] = _UNSET,
    ) -> AsyncIterator[str]:
        """Stream visible content tokens.

        Strategy:
          1. Primary pass — yield ``delta.content`` as it arrives.
             Buffer ``delta.reasoning_content`` silently.
          2. If primary emitted NO content but the reasoning buffer is
             non-empty → flush the reasoning buffer as the visible
             answer. (GLM puts the answer in ``reasoning_content`` when
             the prompt triggers its reasoning path.)
          3. If primary emitted nothing AT ALL (neither content nor
             reasoning) → run ONE salvage retry. Same payload — GLM has
             no reasoning knob to toggle, but transient empties happen.
        """
        # Sentinel accepted for port-contract symmetry; GLM ignores it
        # because the API has no per-request reasoning knob.
        del reasoning_override

        content_emitted = 0
        reasoning_buffer: list[str] = []

        async for kind, value in self._stream_once(
            messages=messages,
            system=system,
            max_tokens=max_tokens,
        ):
            if kind == "content":
                content_emitted += 1
                yield value
            elif kind == "reasoning":
                reasoning_buffer.append(value)

        if content_emitted > 0:
            return

        # Reasoning-as-answer path: model emitted the whole reply via
        # ``reasoning_content``. This is GLM-specific — it does NOT
        # happen with vanilla OpenAI or Groq.
        if reasoning_buffer:
            buffered = "".join(reasoning_buffer)
            logger.warning(
                "[GLM] primary stream returned 0 content tokens but %d "
                "reasoning chars — surfacing reasoning_content as answer "
                "(model=%s)",
                len(buffered),
                self.model,
            )
            yield buffered
            return

        # Salvage path: stream produced absolutely nothing. Retry once.
        logger.warning(
            "[GLM] primary stream returned 0 tokens (content+reasoning); "
            "running one salvage retry (model=%s, base_url=%s)",
            self.model,
            self.base_url,
        )
        retry_reasoning_buffer: list[str] = []
        retry_content_emitted = 0
        async for kind, value in self._stream_once(
            messages=messages,
            system=system,
            max_tokens=max_tokens,
        ):
            if kind == "content":
                retry_content_emitted += 1
                yield value
            elif kind == "reasoning":
                retry_reasoning_buffer.append(value)
        if retry_content_emitted == 0 and retry_reasoning_buffer:
            yield "".join(retry_reasoning_buffer)

    async def _stream_once(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
        reasoning: Any = None,
        disable_thinking: bool = False,
    ) -> AsyncIterator[tuple[str, str]]:
        """One pass against /chat/completions. Yields tuples of (kind, value)
        where kind is 'content' or 'reasoning'. The public ``stream()``
        decides how to expose each.

        ``reasoning`` and ``disable_thinking`` are accepted purely for
        signature compatibility with other clients (e.g. the e2e
        instrumentation tap that duck-types ``_stream_once`` across
        providers). GLM has no per-request reasoning knob — both are
        silently ignored.
        """
        # Accepted for caller-compat, no-op on GLM.
        del reasoning
        del disable_thinking
        payload = self._build_payload(
            messages, system, stream=True, max_tokens=max_tokens
        )
        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST", url, headers=self._headers(), json=payload
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    # Surface GLM's structured error block ({"error":
                    # {"code":"1113","message":"Insufficient balance..."}}).
                    # We log model + base_url but NEVER the api_key.
                    logger.error(
                        "[GLM] HTTP %s on %s/chat/completions (model=%s): %s",
                        response.status_code,
                        self.base_url,
                        self.model,
                        body.decode("utf-8", errors="replace"),
                    )
                    response.raise_for_status()

                async for raw_line in response.aiter_lines():
                    if not raw_line:
                        continue
                    if not raw_line.startswith("data:"):
                        # GLM occasionally emits empty / keep-alive lines;
                        # ignore anything that isn't an SSE data frame.
                        continue
                    data = raw_line[len("data:") :].strip()
                    if data == "":
                        continue
                    if data == "[DONE]":
                        return
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        logger.warning(
                            "[GLM] Skipping non-JSON SSE line: %s", data[:80]
                        )
                        continue

                    choices = event.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    reasoning_content = delta.get("reasoning_content")
                    if content:
                        yield ("content", content)
                    if reasoning_content:
                        # Surfaced so ``stream()`` can detect "all
                        # reasoning, no content" and use it as the
                        # fallback answer. Never yielded directly to
                        # callers via the public stream() unless content
                        # was empty.
                        yield ("reasoning", reasoning_content)

    async def complete(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Non-streaming fallback. Returns the full response as a string.

        Mirrors ``stream()``'s reasoning-as-answer behaviour: if
        ``message.content`` is empty but ``message.reasoning_content``
        is present, return the latter."""
        payload = self._build_payload(
            messages, system, stream=False, max_tokens=max_tokens
        )
        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(
                url, headers=self._headers(), json=payload
            )
            if response.status_code >= 400:
                logger.error(
                    "[GLM] HTTP %s on %s/chat/completions (model=%s): %s",
                    response.status_code,
                    self.base_url,
                    self.model,
                    response.text,
                )
                response.raise_for_status()
            data = response.json()

        choices = data.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        content = message.get("content") or ""
        if content:
            return str(content)
        # GLM-specific fallback: when content is empty, the answer may
        # be in reasoning_content.
        reasoning_content = message.get("reasoning_content") or ""
        return str(reasoning_content)
