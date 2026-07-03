"""SQLite implementation of PreMeetingNotesRepository.

Stores ``probing_questions`` and ``prep_checklist`` as JSON-encoded text
columns (SQLite has no native array type and we want the read path to
remain a single SELECT). The repo trusts the caller for authz; the use
case validates session ownership BEFORE delegating here.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Optional

from app.application.ports.pre_meeting_notes_repository import (
    PreMeetingNotesRepository,
)
from app.domain.entities.pre_meeting_note import PreMeetingNote
from app.infrastructure.persistence.sqlite.db import get_conn


def _parse_dt(value: Optional[str]) -> datetime:
    if value is None:
        return datetime.utcnow()
    try:
        return datetime.fromisoformat(value.replace(" ", "T"))
    except ValueError:
        return datetime.utcnow()


def _dump_list(items: tuple[str, ...]) -> str:
    return json.dumps(list(items), ensure_ascii=False)


def _load_list(raw: Optional[str]) -> tuple[str, ...]:
    if not raw:
        return ()
    try:
        parsed = json.loads(raw)
    except (json.JSONDecodeError, ValueError):
        return ()
    if not isinstance(parsed, list):
        return ()
    out: list[str] = []
    for item in parsed:
        if isinstance(item, str):
            cleaned = item.strip()
            if cleaned:
                out.append(cleaned)
    return tuple(out)


class SQLitePreMeetingNotesRepository(PreMeetingNotesRepository):
    """SQLite-backed pre-meeting notes repository."""

    def create(self, note: PreMeetingNote) -> PreMeetingNote:
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO pre_meeting_notes
                   (id, session_id, user_id, role_target, company_context,
                    job_description, probing_questions, prep_checklist,
                    raw_user_input, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    note.id,
                    note.session_id,
                    note.user_id,
                    note.role_target,
                    note.company_context,
                    note.job_description,
                    _dump_list(note.probing_questions),
                    _dump_list(note.prep_checklist),
                    note.raw_user_input,
                    note.created_at.isoformat(),
                ),
            )
            conn.commit()
        return note

    def get_by_session_id(
        self, session_id: str
    ) -> Optional[PreMeetingNote]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM pre_meeting_notes WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        if row is None:
            return None
        return self._row_to_note(row)

    def delete_by_session_id(self, session_id: str) -> None:
        with get_conn() as conn:
            conn.execute(
                "DELETE FROM pre_meeting_notes WHERE session_id = ?",
                (session_id,),
            )
            conn.commit()

    @staticmethod
    def _row_to_note(row: sqlite3.Row) -> PreMeetingNote:
        return PreMeetingNote(
            id=row["id"],
            session_id=row["session_id"],
            user_id=row["user_id"],
            role_target=row["role_target"],
            company_context=row["company_context"],
            job_description=row["job_description"],
            probing_questions=_load_list(row["probing_questions"]),
            prep_checklist=_load_list(row["prep_checklist"]),
            raw_user_input=row["raw_user_input"],
            created_at=_parse_dt(row["created_at"]),
        )
