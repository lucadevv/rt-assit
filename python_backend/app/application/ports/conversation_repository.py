"""Repository port for conversation memory (questions + agent hints)."""
from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.conversation import Hint, Question


class ConversationRepository(ABC):
    """Abstract conversation memory. Currently in-memory; can be SQLite later."""

    @abstractmethod
    def add_question(self, session_id: str, text: str) -> None: ...

    @abstractmethod
    def add_hint(
        self, session_id: str, text: str, related_question: Optional[str] = None
    ) -> None: ...

    @abstractmethod
    def get_recent_questions(self, session_id: str, n: int = 5) -> list[Question]: ...

    @abstractmethod
    def get_recent_hints(self, session_id: str, n: int = 5) -> list[Hint]: ...

    @abstractmethod
    def clear(self, session_id: str) -> None: ...
