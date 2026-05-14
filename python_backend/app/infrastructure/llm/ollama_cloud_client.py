"""Ollama Cloud client. Streams JSON-lines (NDJSON), not SSE."""
import json
import logging
from typing import AsyncIterator, List, Optional, Union

import httpx

from app.application.ports.llm_provider import LLMProvider
from app.domain.entities.chat_message import ChatMessage


logger = logging.getLogger(__name__)


# Sentinel used to differentiate "caller did not pass a reasoning value"
# (use the client's default ``self.reasoning``) from "caller explicitly
# passed None" (disable reasoning for THIS call only).
# Equality is by identity (singleton instance), so callers should compare
# with ``is`` / ``is not``.
class _Unset:
    """Marker type for ``reasoning_override`` default. NOT exported."""

    __slots__ = ()

    def __repr__(self) -> str:  # pragma: no cover — debug aid
        return "<UNSET>"


_UNSET: "_Unset" = _Unset()


class OllamaCloudClient(LLMProvider):
    """Ollama Cloud client. Streams JSON-lines (NDJSON), not SSE."""

    def __init__(
        self,
        api_key: str,
        model: str = "minimax-m2.5:cloud",
        base_url: str = "https://ollama.com",
        temperature: float = 0.7,
        timeout: float = 60.0,
        reasoning: Optional[str] = None,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.temperature = temperature
        self.timeout = timeout
        # Reasoning effort for reasoning models (e.g. gpt-oss). One of: "low", "medium", "high".
        # Top-level field on /api/chat — NOT inside options.
        self.reasoning = reasoning

    # Default num_predict (max output tokens). Set high enough to give
    # reasoning models (gpt-oss) headroom for both the reasoning trace AND
    # the visible content. We observed cases where reasoning consumed the
    # default budget and `content` came back empty — caller fell to the
    # Spanish "no entendí" fallback even though the question was clear.
    DEFAULT_NUM_PREDICT = 2000

    # Extra `num_predict` headroom reserved for the reasoning trace when a
    # reasoning model is active (gpt-oss family). On Ollama Cloud the
    # `num_predict` budget covers BOTH thinking + content; callers size their
    # caps for the visible answer (300-500). Without this reservation, the
    # reasoning trace consumes the entire budget on harder prompts ("defina X",
    # "explicá Y") and the visible content comes back empty.
    # 600 was picked from the worst-case observed in the E2E suite
    # (thesis_defense averaged 546 thinking tokens) + 10% margin.
    REASONING_HEADROOM_TOKENS = 600

    # Hard floor when reasoning is active — even very short scenarios need
    # at least this much budget or the trace will starve the content.
    MIN_NUM_PREDICT_WITH_REASONING = 1000

    def _build_payload(
        self,
        messages: List[ChatMessage],
        system: Optional[str],
        stream: bool,
        max_tokens: Optional[int] = None,
        reasoning: Optional[str] = None,
        disable_thinking: bool = False,
    ) -> dict:
        """Build the /api/chat payload.

        ``reasoning`` is the effort level (``"low"`` / ``"medium"`` /
        ``"high"``) sent as top-level ``reasoning``. None means "don't
        send a reasoning field". For reasoning-capable models (gpt-oss),
        omitting the field falls back to the model's internal default
        (typically ``medium``) — which is NOT what we want when callers
        say "fast scenario, no thinking".

        ``disable_thinking`` is the EXPLICIT off switch. When True we
        send the top-level ``think: false`` (Ollama-native), which fully
        disables the thinking trace at the model level. Used by the
        sentinel pattern in ``stream()`` when callers explicitly pass
        ``reasoning_override=None`` for the fastest scenarios (personal,
        meeting_business, client_call).
        """
        wire_messages: list[dict] = []
        if system:
            wire_messages.append({"role": "system", "content": system})
        for m in messages:
            wire_messages.append({"role": m.role, "content": m.content})
        payload: dict = {
            "model": self.model,
            "messages": wire_messages,
            "stream": stream,
            "temperature": self.temperature,
        }
        # Ollama controls generation length via options.num_predict.
        # We always set a sane default — the gpt-oss reasoning trace can
        # easily eat 1000+ tokens before any visible content is emitted.
        effective_tokens = max_tokens if max_tokens is not None else self.DEFAULT_NUM_PREDICT
        # When reasoning is active (or could be active because we DIDN'T
        # explicitly disable it), the `num_predict` budget is shared with
        # the thinking trace. Pad the caller's cap so the visible answer
        # actually has room. Skip the pad ONLY when thinking is explicitly
        # off via `think: false` — in that case the budget belongs to
        # content alone.
        if not disable_thinking:
            effective_tokens = max(
                effective_tokens + self.REASONING_HEADROOM_TOKENS,
                self.MIN_NUM_PREDICT_WITH_REASONING,
            )
        payload["options"] = {"num_predict": effective_tokens}
        if reasoning is not None:
            # Top-level reasoning effort knob for reasoning models (gpt-oss, etc.)
            payload["reasoning"] = reasoning
        if disable_thinking:
            # Ollama-native: turn off the thinking trace at the model level.
            # Without this, gpt-oss emits its reasoning regardless of whether
            # we omit `reasoning` — leaving content starved on tight budgets.
            payload["think"] = False
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

        ``reasoning_override`` sentinel pattern:
          - default (``_UNSET``) → use ``self.reasoning`` (constructor value).
          - explicit ``None``    → DISABLE thinking entirely (``think:false``).
          - explicit ``"low"`` / ``"medium"`` / ``"high"`` → override effort.

        Implementation note: when the caller passes ``None`` explicitly,
        we send Ollama's native ``think: false`` so the model doesn't
        emit a thinking trace at all. Without this, gpt-oss-family
        models still spend tokens on internal reasoning even when the
        ``reasoning`` field is omitted, starving tight budgets.
        """
        caller_explicit = not isinstance(reasoning_override, _Unset)
        effective_reasoning: Optional[str] = (
            reasoning_override if caller_explicit else self.reasoning
        )
        # Thinking is fully disabled only when the caller EXPLICITLY
        # passed None. "Caller didn't say + self.reasoning is None"
        # keeps the legacy behaviour (omit the field, model picks its
        # default — preserves backwards compat for non-reasoning models).
        disable_thinking = caller_explicit and reasoning_override is None

        # Primary attempt.
        # When thinking is disabled we still defensively track
        # ``thinking_seen`` so the salvage path can react if the model
        # ignores ``think: false`` (it shouldn't, but networks are weird).
        content_emitted = 0
        thinking_seen = 0
        async for chunk in self._stream_once(
            messages,
            system,
            max_tokens,
            reasoning=effective_reasoning,
            disable_thinking=disable_thinking,
        ):
            kind, value = chunk
            if kind == "content":
                content_emitted += 1
                yield value
            elif kind == "thinking":
                thinking_seen += 1

        if content_emitted > 0:
            return

        # Salvage path: reasoning ate the whole budget OR the model
        # ignored think:false (gpt-oss does this in practice — even
        # with ``think: false`` we still see 100-200 thinking tokens).
        # Retry once with reasoning="low" + the normal padded budget so
        # the model has room for both its uncontrollable thinking AND
        # visible content.
        if thinking_seen > 0:
            retry_reasoning = "low"
            logger.warning(
                "[OllamaCloud] content empty after %d thinking tokens "
                "(disable_thinking=%s on primary) — retrying once with "
                "reasoning=%r and padded budget",
                thinking_seen, disable_thinking, retry_reasoning,
            )
            async for chunk in self._stream_once(
                messages,
                system,
                max_tokens,
                reasoning=retry_reasoning,
                disable_thinking=False,
            ):
                kind, value = chunk
                if kind == "content":
                    yield value

    async def _stream_once(
        self,
        messages: List[ChatMessage],
        system: Optional[str],
        max_tokens: Optional[int],
        reasoning: Optional[str],
        disable_thinking: bool = False,
    ) -> AsyncIterator[tuple[str, str]]:
        """One pass against /api/chat. Yields tuples of (kind, value) where
        kind is 'content' or 'thinking'. The public `stream()` filters by
        kind and decides whether to expose thinking-only fallbacks."""
        payload = self._build_payload(
            messages,
            system,
            stream=True,
            max_tokens=max_tokens,
            reasoning=reasoning,
            disable_thinking=disable_thinking,
        )
        url = f"{self.base_url}/api/chat"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST", url, headers=self._headers(), json=payload
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    logger.error(
                        "[OllamaCloud] HTTP %s: %s",
                        response.status_code,
                        body.decode("utf-8", errors="replace"),
                    )
                    response.raise_for_status()

                async for raw_line in response.aiter_lines():
                    if not raw_line:
                        continue
                    line = raw_line.strip()
                    if not line:
                        continue
                    try:
                        event = json.loads(line)
                    except json.JSONDecodeError:
                        logger.warning("[OllamaCloud] Skipping non-JSON line: %s", line[:80])
                        continue

                    message = event.get("message") or {}
                    content = message.get("content")
                    thinking = message.get("thinking")
                    if content:
                        yield ("content", content)
                    if thinking:
                        # Surfaced so `stream()` can detect "all reasoning,
                        # no content" and retry. Never yielded to callers
                        # directly.
                        yield ("thinking", thinking)
                    if event.get("done"):
                        return

    async def complete(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        payload = self._build_payload(
            messages,
            system,
            stream=False,
            max_tokens=max_tokens,
            reasoning=self.reasoning,
        )
        url = f"{self.base_url}/api/chat"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=self._headers(), json=payload)
            response.raise_for_status()
            data = response.json()

        message = data.get("message") or {}
        return str(message.get("content") or "")
