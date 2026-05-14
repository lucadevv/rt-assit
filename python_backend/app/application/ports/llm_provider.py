"""LLMProvider port — abstract LLM streaming/non-streaming interface."""
from abc import ABC, abstractmethod
from typing import Any, AsyncIterator, List, Optional

from app.domain.entities.chat_message import ChatMessage


class LLMProvider(ABC):
    """Abstract LLM provider with both streaming and non-streaming entry points."""

    @abstractmethod
    def stream(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
        reasoning_override: Any = ...,
    ) -> AsyncIterator[str]:
        """Yield text chunks as they arrive from the LLM. First chunk should arrive ASAP.

        ``reasoning_override`` is a per-call escape hatch for clients that
        support reasoning effort (e.g. Ollama Cloud + gpt-oss). The default
        is a sentinel meaning "use the provider's configured reasoning";
        explicit ``None`` means "disable reasoning for THIS call only";
        explicit strings ("low" / "medium" / "high") override it. Clients
        that don't support reasoning MUST accept and ignore this argument.
        """
        ...

    @abstractmethod
    async def complete(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        """Non-streaming fallback returning the full response as a single string."""
        ...
