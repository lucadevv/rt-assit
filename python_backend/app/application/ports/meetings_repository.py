"""MeetingsRepository — Protocol for persisting Meeting records.

Provider-agnostic. Implementations live under
``infrastructure/persistence/*`` (SQLite for now)."""
from __future__ import annotations

from typing import Protocol, runtime_checkable

from app.domain.entities.meeting import Meeting


@runtime_checkable
class MeetingsRepository(Protocol):
    def save(self, meeting: Meeting) -> None: ...

    def get(self, meeting_id: str) -> Meeting | None: ...

    def list_for_user(self, user_id: str, limit: int = 50) -> list[Meeting]: ...

    def delete(self, meeting_id: str) -> None: ...
