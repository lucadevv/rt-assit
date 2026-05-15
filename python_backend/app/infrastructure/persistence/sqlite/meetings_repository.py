"""SQLite implementation of ``MeetingsRepository`` (Sprint 1).

Stores provider-agnostic Meeting rows. The provider-specific id
(e.g. ``spaces/abc123`` for Meet) lives in ``provider_meeting_id`` so the
provider service can look it up later (delete, end meeting, etc.) without
parsing ``join_url``."""
from __future__ import annotations

import sqlite3
from typing import cast

from app.application.ports.meetings_repository import MeetingsRepository
from app.domain.entities.meeting import Meeting, MeetingProvider


class SqliteMeetingsRepository(MeetingsRepository):
    def __init__(self, db_path: str) -> None:
        self._db_path = db_path

    # ----- public API ------------------------------------------------------

    def save(self, meeting: Meeting) -> None:
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO meetings
                   (id, user_id, provider, join_url, provider_meeting_id,
                    title, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                       user_id = excluded.user_id,
                       provider = excluded.provider,
                       join_url = excluded.join_url,
                       provider_meeting_id = excluded.provider_meeting_id,
                       title = excluded.title,
                       created_at = excluded.created_at""",
                (
                    meeting.id,
                    meeting.user_id,
                    meeting.provider,
                    meeting.join_url,
                    meeting.provider_meeting_id,
                    meeting.title,
                    meeting.created_at,
                ),
            )
            conn.commit()

    def get(self, meeting_id: str) -> Meeting | None:
        with self._connect() as conn:
            row = conn.execute(
                """SELECT id, user_id, provider, join_url, provider_meeting_id,
                          title, created_at
                   FROM meetings WHERE id = ?""",
                (meeting_id,),
            ).fetchone()
        return self._row_to_entity(row) if row else None

    def list_for_user(self, user_id: str, limit: int = 50) -> list[Meeting]:
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT id, user_id, provider, join_url, provider_meeting_id,
                          title, created_at
                   FROM meetings
                   WHERE user_id = ?
                   ORDER BY created_at DESC
                   LIMIT ?""",
                (user_id, limit),
            ).fetchall()
        return [self._row_to_entity(r) for r in rows]

    def delete(self, meeting_id: str) -> None:
        with self._connect() as conn:
            conn.execute("DELETE FROM meetings WHERE id = ?", (meeting_id,))
            conn.commit()

    # ----- internal helpers -----------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _row_to_entity(self, row: sqlite3.Row) -> Meeting:
        return Meeting(
            id=row["id"],
            user_id=row["user_id"],
            provider=cast(MeetingProvider, row["provider"]),
            join_url=row["join_url"],
            provider_meeting_id=row["provider_meeting_id"],
            title=row["title"],
            created_at=row["created_at"],
        )
