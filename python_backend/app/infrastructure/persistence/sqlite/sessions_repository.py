"""SQLite implementation of SessionsRepository (B1)."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any, Optional

from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session import Session, SessionMode
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteSessionsRepository(SessionsRepository):
    """SQLite-backed sessions repository.

    All queries scope by ``user_id`` and exclude soft-deleted rows. Datetime
    fields are stored as ``YYYY-MM-DD HH:MM:SS`` (SQLite ``datetime('now')``)
    and parsed back to naive UTC ``datetime`` at the boundary."""

    def create(
        self,
        *,
        session_id: str,
        user_id: str,
        scenario: str,
        my_language: str,
        other_language: str,
        is_recording: bool,
        title: Optional[str],
        metadata: Optional[dict[str, Any]] = None,
        mode: SessionMode = "agent",
        meeting_id: Optional[str] = None,
    ) -> Session:
        # Defensive boundary check: any value outside the SessionMode
        # literal collapses to the safe default ``"agent"`` rather than
        # raising. The presentation layer validates strictly via
        # Pydantic, so this is only reached when an internal caller
        # passes a malformed value.
        safe_mode: SessionMode = mode if mode in ("agent", "scribe") else "agent"
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO sessions
                   (id, user_id, scenario, title, my_language, other_language,
                    is_recording, action_items, metadata, mode, meeting_id)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    session_id,
                    user_id,
                    scenario,
                    title,
                    my_language,
                    other_language,
                    1 if is_recording else 0,
                    json.dumps([]),
                    json.dumps(metadata or {}),
                    safe_mode,
                    meeting_id,
                ),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM sessions WHERE id = ? AND user_id = ?",
                (session_id, user_id),
            ).fetchone()
        if row is None:
            raise RuntimeError(f"failed to insert session {session_id}")
        return _row_to_session(row)

    def get(self, session_id: str, user_id: str) -> Optional[Session]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM sessions
                   WHERE id = ? AND user_id = ? AND deleted_at IS NULL""",
                (session_id, user_id),
            ).fetchone()
        return _row_to_session(row) if row else None

    def get_including_deleted(
        self, session_id: str, user_id: str
    ) -> Optional[Session]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM sessions
                   WHERE id = ? AND user_id = ?""",
                (session_id, user_id),
            ).fetchone()
        return _row_to_session(row) if row else None

    def get_active_for_user(self, user_id: str) -> Optional[Session]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM sessions
                   WHERE user_id = ?
                     AND ended_at IS NULL
                     AND deleted_at IS NULL
                   ORDER BY started_at DESC
                   LIMIT 1""",
                (user_id,),
            ).fetchone()
        return _row_to_session(row) if row else None

    def list(
        self,
        *,
        user_id: str,
        scenario: Optional[str] = None,
        search: Optional[str] = None,
        limit: int = 20,
        offset: int = 0,
    ) -> list[Session]:
        query = (
            "SELECT * FROM sessions WHERE user_id = ? AND deleted_at IS NULL"
        )
        params: list[Any] = [user_id]
        if scenario is not None:
            query += " AND scenario = ?"
            params.append(scenario)
        if search:
            # Simple LIKE for B1 — FTS over title/summary can be added later.
            query += " AND (title LIKE ? OR summary LIKE ?)"
            like = f"%{search}%"
            params.extend([like, like])
        query += " ORDER BY started_at DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with get_conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [_row_to_session(r) for r in rows]

    def update(
        self,
        *,
        session_id: str,
        user_id: str,
        title: Optional[str] = None,
        ended_at: Optional[datetime] = None,
        duration_seconds: Optional[int] = None,
        summary: Optional[str] = None,
        action_items: Optional[list[str]] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> Session:
        # Build dynamic SET so only provided fields are touched.
        fields: list[str] = []
        params: list[Any] = []
        if title is not None:
            fields.append("title = ?")
            params.append(title)
        if ended_at is not None:
            fields.append("ended_at = ?")
            params.append(ended_at.strftime("%Y-%m-%d %H:%M:%S"))
        if duration_seconds is not None:
            fields.append("duration_seconds = ?")
            params.append(int(duration_seconds))
        if summary is not None:
            fields.append("summary = ?")
            params.append(summary)
        if action_items is not None:
            fields.append("action_items = ?")
            params.append(json.dumps(action_items))
        if metadata is not None:
            fields.append("metadata = ?")
            params.append(json.dumps(metadata))

        if fields:
            params.extend([session_id, user_id])
            with get_conn() as conn:
                conn.execute(
                    f"""UPDATE sessions SET {', '.join(fields)}
                        WHERE id = ? AND user_id = ? AND deleted_at IS NULL""",
                    params,
                )
                conn.commit()

        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM sessions
                   WHERE id = ? AND user_id = ? AND deleted_at IS NULL""",
                (session_id, user_id),
            ).fetchone()
        if row is None:
            raise RuntimeError(f"session {session_id} not found")
        return _row_to_session(row)

    def soft_delete(self, session_id: str, user_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                """UPDATE sessions SET deleted_at = datetime('now')
                   WHERE id = ? AND user_id = ? AND deleted_at IS NULL""",
                (session_id, user_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def count_for_user(self, user_id: str) -> int:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT COUNT(*) AS n FROM sessions
                   WHERE user_id = ? AND deleted_at IS NULL""",
                (user_id,),
            ).fetchone()
        return int(row["n"]) if row else 0

    def list_stale_active(
        self, *, started_before: datetime
    ) -> list[Session]:
        cutoff = started_before.strftime("%Y-%m-%d %H:%M:%S")
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM sessions
                   WHERE ended_at IS NULL
                     AND deleted_at IS NULL
                     AND started_at < ?
                   ORDER BY started_at ASC""",
                (cutoff,),
            ).fetchall()
        return [_row_to_session(r) for r in rows]

    def mark_abandoned(self, session_id: str) -> bool:
        # Atomic UPDATE — sets ended_at to the row's own started_at and
        # zero-duration. Only touches rows that are still open
        # (ended_at IS NULL) and not soft-deleted.
        with get_conn() as conn:
            cur = conn.execute(
                """UPDATE sessions
                   SET ended_at = started_at,
                       duration_seconds = 0
                   WHERE id = ?
                     AND ended_at IS NULL
                     AND deleted_at IS NULL""",
                (session_id,),
            )
            conn.commit()
            return cur.rowcount > 0


def _row_to_session(row: sqlite3.Row) -> Session:
    raw_action_items = row["action_items"]
    raw_metadata = row["metadata"]
    # ``mode`` column was added by the session-mode migration. Older DB
    # snapshots that booted before the migration may still hand us a
    # row without the column when accessed via raw ``sqlite3.Row``;
    # ``try/except IndexError`` handles that defensively. Anything that
    # isn't the agent/scribe literal collapses back to ``"agent"`` so
    # one corrupt row can't break the pipeline.
    try:
        raw_mode = row["mode"]
    except (IndexError, KeyError):
        raw_mode = None
    mode: SessionMode = raw_mode if raw_mode in ("agent", "scribe") else "agent"
    # ``meeting_id`` column was added by the Sprint 1.5 migration. Defensive
    # try/except so an older raw row without the column degrades to ``None``
    # rather than raising — same pattern as ``mode`` above.
    try:
        raw_meeting_id = row["meeting_id"]
    except (IndexError, KeyError):
        raw_meeting_id = None
    return Session(
        id=row["id"],
        user_id=row["user_id"],
        scenario=row["scenario"],
        title=row["title"],
        my_language=row["my_language"],
        other_language=row["other_language"],
        started_at=_parse_dt(row["started_at"]) or datetime.utcnow(),
        ended_at=_parse_dt(row["ended_at"]),
        duration_seconds=row["duration_seconds"],
        is_recording=bool(row["is_recording"]),
        summary=row["summary"],
        action_items=json.loads(raw_action_items) if raw_action_items else [],
        metadata=json.loads(raw_metadata) if raw_metadata else {},
        deleted_at=_parse_dt(row["deleted_at"]),
        mode=mode,
        meeting_id=raw_meeting_id if isinstance(raw_meeting_id, str) else None,
    )


def _parse_dt(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    normalised = value.replace("T", " ")
    try:
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None
