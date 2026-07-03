"""Fetch the pre-meeting note for a session.

Authz: validates that the session belongs to the user BEFORE returning
the note. Returns ``None`` when no note exists (the live UI hides the
prep card in that case)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.application.ports.pre_meeting_notes_repository import (
    PreMeetingNotesRepository,
)
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.pre_meeting_note import PreMeetingNote
from app.domain.exceptions import NotFoundError


@dataclass
class GetPreMeetingNoteUseCase:
    notes_repo: PreMeetingNotesRepository
    sessions_repo: SessionsRepository

    def execute(
        self, *, session_id: str, user_id: str
    ) -> Optional[PreMeetingNote]:
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")
        return self.notes_repo.get_by_session_id(session_id)


__all__ = ["GetPreMeetingNoteUseCase"]
