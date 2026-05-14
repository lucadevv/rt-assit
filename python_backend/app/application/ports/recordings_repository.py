"""Repository port for recording persistence (B6)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from app.domain.entities.recording import Recording
from app.domain.entities.session import Session


class RecordingsRepository(ABC):
    """Abstract recordings store. Implementations: SQLite (current), Postgres (future)."""

    @abstractmethod
    def upsert(self, recording: Recording) -> Recording:
        """Insert or replace the recording row keyed by ``session_id``.

        Returns the persisted entity (the same dataclass instance is fine —
        callers don't rely on identity)."""
        ...

    @abstractmethod
    def get(self, session_id: str) -> Optional[Recording]:
        """Fetch the recording for a session. ``None`` if no recording."""
        ...

    @abstractmethod
    def delete(self, session_id: str) -> bool:
        """Remove the recording row. Returns True if a row was deleted."""
        ...

    @abstractmethod
    def list_expired(self, now: datetime) -> list[Recording]:
        """Return recordings whose ``expires_at`` is non-null and ``<= now``.

        Used by the daily cleanup cron (``CleanupExpiredRecordingsUseCase``)."""
        ...

    @abstractmethod
    def list_for_user(
        self, user_id: str, *, limit: int = 20, offset: int = 0
    ) -> list[tuple[Recording, Session]]:
        """List a user's recordings joined with their parent session.

        Multi-tenant safety enforced by the JOIN on ``sessions.user_id``."""
        ...
