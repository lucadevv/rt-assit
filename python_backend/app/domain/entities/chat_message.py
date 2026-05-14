"""Provider-agnostic chat message used by LLM ports."""
from dataclasses import dataclass
from typing import Literal


Role = Literal["system", "user", "assistant"]


@dataclass
class ChatMessage:
    """Provider-agnostic chat message. Convert provider-specific messages to this at the boundary."""

    role: Role
    content: str
