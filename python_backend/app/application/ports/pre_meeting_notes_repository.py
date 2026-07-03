"""Pre-meeting notes repository port.

Authz contract mirrors session_materials: the use case validates session
ownership BEFORE calling the repo. The repo itself trusts the session_id +
user_id it receives. Session deletion cascades the row (FK ON DELETE
CASCADE in the SQLite schema)."""
from __future__ import annotations

from typing import Optional, Protocol

from app.domain.entities.pre_meeting_note import PreMeetingNote


class PreMeetingNotesRepository(Protocol):
    def create(self, note: PreMeetingNote) -> PreMeetingNote: ...

    def get_by_session_id(
        self, session_id: str
    ) -> Optional[PreMeetingNote]: ...

    def delete_by_session_id(self, session_id: str) -> None: ...
