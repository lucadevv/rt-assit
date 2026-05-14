"""Groq OpenAI-compatible client. Streams SSE."""
import json
import logging
from typing import Any, AsyncIterator, List, Optional

import httpx

from app.application.ports.llm_provider import LLMProvider
from app.domain.entities.chat_message import ChatMessage


logger = logging.getLogger(__name__)


# Sentinel — Groq doesn't speak "reasoning effort"; we accept the param
# for port-compatibility and silently ignore it.
_GROQ_UNSET = object()


class GroqClient(LLMProvider):
    """Groq OpenAI-compatible client. Streams SSE."""

    def __init__(
        self,
        api_key: str,
        model: str = "llama-3.3-70b-versatile",
        base_url: str = "https://api.groq.com/openai/v1",
        temperature: float = 0.7,
        timeout: float = 60.0,
    ) -> None:
        self.api_key = api_key
        self.model = model
        self.base_url = base_url.rstrip("/")
        self.temperature = temperature
        self.timeout = timeout

    def _build_payload(
        self,
        messages: List[ChatMessage],
        system: Optional[str],
        stream: bool,
        max_tokens: Optional[int] = None,
    ) -> dict:
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
        if max_tokens is not None:
            payload["max_tokens"] = max_tokens
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
        reasoning_override: Any = _GROQ_UNSET,
    ) -> AsyncIterator[str]:
        # Groq doesn't support reasoning effort — accept the param for
        # port compatibility and silently ignore it. ``del`` to make
        # intent obvious and silence linters.
        del reasoning_override
        payload = self._build_payload(messages, system, stream=True, max_tokens=max_tokens)
        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            async with client.stream(
                "POST", url, headers=self._headers(), json=payload
            ) as response:
                if response.status_code >= 400:
                    body = await response.aread()
                    logger.error(
                        "[Groq] HTTP %s: %s", response.status_code, body.decode("utf-8", errors="replace")
                    )
                    response.raise_for_status()

                async for raw_line in response.aiter_lines():
                    if not raw_line:
                        continue
                    if not raw_line.startswith("data:"):
                        continue
                    data = raw_line[len("data:") :].strip()
                    if data == "" or data == "[DONE]":
                        if data == "[DONE]":
                            return
                        continue
                    try:
                        event = json.loads(data)
                    except json.JSONDecodeError:
                        logger.warning("[Groq] Skipping non-JSON SSE line: %s", data[:80])
                        continue

                    choices = event.get("choices") or []
                    if not choices:
                        continue
                    delta = choices[0].get("delta") or {}
                    content = delta.get("content")
                    if content:
                        yield content

    async def complete(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        payload = self._build_payload(messages, system, stream=False, max_tokens=max_tokens)
        url = f"{self.base_url}/chat/completions"

        async with httpx.AsyncClient(timeout=self.timeout) as client:
            response = await client.post(url, headers=self._headers(), json=payload)
            response.raise_for_status()
            data = response.json()

        choices = data.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        return str(message.get("content") or "")
