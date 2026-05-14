"""Repository port for transcript persistence (B1, extended in B2)."""
from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.persisted_transcript import PersistedTranscript


class TranscriptsRepository(ABC):
    """Abstract transcripts store with FTS5 search support."""

    @abstractmethod
    def append(
        self,
        *,
        session_id: str,
        content: str,
        is_final: bool,
        timestamp_ms: int,
        speaker_id: Optional[int] = None,
        deepgram_speaker: Optional[int] = None,
        language: Optional[str] = None,
        confidence: Optional[float] = None,
    ) -> PersistedTranscript:
        """Insert a new transcript row. Returns the row with its assigned id."""
        ...

    @abstractmethod
    def get_for_session(
        self,
        *,
        session_id: str,
        only_final: bool = False,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[PersistedTranscript]:
        """Ordered by timestamp_ms ASC."""
        ...

    @abstractmethod
    def get_by_id(self, transcript_id: int) -> Optional[PersistedTranscript]:
        """Fetch a transcript by primary key (no user scoping; the use case
        verifies ownership via the session)."""
        ...

    @abstractmethod
    def update_content(
        self, transcript_id: int, new_content: str
    ) -> PersistedTranscript:
        """Replace the ``content`` text. The FTS5 trigger keeps the index in sync."""
        ...

    @abstractmethod
    def search(
        self,
        *,
        session_id: str,
        query: str,
        limit: int = 50,
    ) -> list[PersistedTranscript]:
        """FTS5 search within a session's transcripts."""
        ...

    @abstractmethod
    def search_for_user(
        self,
        *,
        user_id: str,
        query: str,
        session_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[PersistedTranscript]:
        """FTS5 search across the user's sessions (multi-tenant safe).

        Joins through ``sessions`` so callers cannot leak transcripts
        across tenants. Optional ``session_id`` narrows to one session."""
        ...

    @abstractmethod
    def count_for_session(self, session_id: str) -> int: ...
