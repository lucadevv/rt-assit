"""Repository port for speaker persistence (B1)."""
from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.speaker import Speaker


class SpeakersRepository(ABC):
    @abstractmethod
    def get_or_create(
        self,
        *,
        session_id: str,
        deepgram_speaker_id: int,
        is_user: bool = False,
    ) -> Speaker:
        """Idempotent: returns existing speaker or creates a fresh row.

        UNIQUE(session_id, deepgram_speaker_id) on the table avoids dupes."""
        ...

    @abstractmethod
    def get_by_deepgram_id(
        self, *, session_id: str, deepgram_speaker_id: int
    ) -> Optional[Speaker]: ...

    @abstractmethod
    def rename(
        self,
        *,
        session_id: str,
        deepgram_speaker_id: int,
        label: Optional[str],
    ) -> Speaker:
        """Update label only. Other fields untouched."""
        ...

    @abstractmethod
    def upsert_label(
        self,
        *,
        session_id: str,
        deepgram_speaker_id: int,
        label: Optional[str],
        is_user: bool = False,
    ) -> Speaker:
        """Insert-or-update a speaker with the given label (B3).

        Idempotent: creates a fresh row if (session_id, deepgram_speaker_id)
        is new, otherwise updates only the label. Used by rename / merge
        flows where the deepgram_speaker_id may not have been seen yet."""
        ...

    @abstractmethod
    def list_for_session(self, session_id: str) -> list[Speaker]: ...
