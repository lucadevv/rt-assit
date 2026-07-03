"""Persist a pre-meeting note onto an existing session.

Authz: the use case validates session ownership BEFORE writing — same
contract as session_materials. The session must exist and belong to the
authenticated user. Any subsequent re-generation goes through this use
case again (the SQLite layer enforces UNIQUE(session_id), so a duplicate
attempt raises and the caller can choose to delete-then-create or
ignore)."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional
from uuid import uuid4

from app.application.ports.pre_meeting_notes_repository import (
    PreMeetingNotesRepository,
)
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.pre_meeting_note import PreMeetingNote
from app.domain.exceptions import NotFoundError


@dataclass
class CreatePreMeetingNoteUseCase:
    notes_repo: PreMeetingNotesRepository
    sessions_repo: SessionsRepository

    def execute(
        self,
        *,
        session_id: str,
        user_id: str,
        role_target: str,
        company_context: str,
        job_description: Optional[str],
        probing_questions: tuple[str, ...],
        prep_checklist: tuple[str, ...],
        raw_user_input: str,
    ) -> PreMeetingNote:
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        existing = self.notes_repo.get_by_session_id(session_id)
        if existing is not None:
            self.notes_repo.delete_by_session_id(session_id)

        note = PreMeetingNote(
            id=f"pmn_{uuid4().hex[:24]}",
            session_id=session_id,
            user_id=user_id,
            role_target=role_target,
            company_context=company_context,
            job_description=job_description,
            probing_questions=probing_questions,
            prep_checklist=prep_checklist,
            raw_user_input=raw_user_input,
            created_at=datetime.utcnow(),
        )
        return self.notes_repo.create(note)


__all__ = ["CreatePreMeetingNoteUseCase"]
