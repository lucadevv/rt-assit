"""Repository port for hint persistence (B1)."""
from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.hint import Hint


class HintsRepository(ABC):
    @abstractmethod
    def append(
        self,
        *,
        session_id: str,
        content: str,
        timestamp_ms: int,
        related_transcript_id: Optional[int] = None,
    ) -> Hint:
        """Insert a hint row. Returns the row with its assigned id."""
        ...

    @abstractmethod
    def get_for_session(self, session_id: str) -> list[Hint]:
        """Ordered by timestamp_ms ASC."""
        ...
