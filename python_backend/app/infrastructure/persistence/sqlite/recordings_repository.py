"""SQLite adapter for ``RecordingsRepository`` (B6)."""
from __future__ import annotations

from datetime import datetime
from typing import Optional

from app.application.ports.recordings_repository import RecordingsRepository
from app.domain.entities.recording import Recording
from app.domain.entities.session import Session, SessionMode
from app.infrastructure.persistence.sqlite.db import get_conn


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if not value:
        return None
    # SQLite ``datetime('now')`` and our ISO writes both end up here.
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        # Defensive: trim trailing 'Z' or microsecond noise.
        try:
            return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None


def _row_to_recording(row) -> Recording:
    return Recording(
        session_id=row["session_id"],
        audio_path=row["audio_path"],
        audio_format=row["audio_format"],
        audio_duration_seconds=int(row["audio_duration_seconds"] or 0),
        audio_size_bytes=int(row["audio_size_bytes"] or 0),
        expires_at=_parse_datetime(row["expires_at"]),
        created_at=_parse_datetime(row["created_at"]) or datetime.utcnow(),
    )


def _row_to_session(row) -> Session:
    """Reconstruct a Session from a JOIN row prefixed with ``s_``.

    Mirrors ``SQLiteSessionsRepository._row_to_session`` but reads the aliased
    columns. Kept local to this module so we don't couple repos."""
    import json

    action_items_raw = row["s_action_items"]
    metadata_raw = row["s_metadata"]
    action_items: list[str] = []
    metadata: dict = {}
    try:
        if action_items_raw:
            action_items = json.loads(action_items_raw)
    except (ValueError, TypeError):
        action_items = []
    try:
        if metadata_raw:
            metadata = json.loads(metadata_raw)
    except (ValueError, TypeError):
        metadata = {}

    # ``s_mode`` is missing from rows produced by very old JOIN queries
    # (defensive). Anything outside the SessionMode literal collapses
    # back to ``"agent"`` so a corrupt row can't break the boundary.
    try:
        raw_mode = row["s_mode"]
    except (IndexError, KeyError):
        raw_mode = None
    mode: SessionMode = raw_mode if raw_mode in ("agent", "scribe") else "agent"

    return Session(
        id=row["s_id"],
        user_id=row["s_user_id"],
        scenario=row["s_scenario"],
        title=row["s_title"],
        my_language=row["s_my_language"],
        other_language=row["s_other_language"],
        started_at=_parse_datetime(row["s_started_at"]) or datetime.utcnow(),
        ended_at=_parse_datetime(row["s_ended_at"]),
        duration_seconds=row["s_duration_seconds"],
        is_recording=bool(row["s_is_recording"]),
        summary=row["s_summary"],
        action_items=action_items,
        metadata=metadata,
        deleted_at=_parse_datetime(row["s_deleted_at"]),
        mode=mode,
    )


class SQLiteRecordingsRepository(RecordingsRepository):
    """SQLite-backed recordings store. PK = session_id (1:1 with sessions)."""

    def upsert(self, recording: Recording) -> Recording:
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO recordings (
                    session_id, audio_path, audio_format,
                    audio_duration_seconds, audio_size_bytes,
                    expires_at, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(session_id) DO UPDATE SET
                    audio_path = excluded.audio_path,
                    audio_format = excluded.audio_format,
                    audio_duration_seconds = excluded.audio_duration_seconds,
                    audio_size_bytes = excluded.audio_size_bytes,
                    expires_at = excluded.expires_at,
                    created_at = excluded.created_at
                """,
                (
                    recording.session_id,
                    recording.audio_path,
                    recording.audio_format,
                    int(recording.audio_duration_seconds),
                    int(recording.audio_size_bytes),
                    recording.expires_at.isoformat()
                    if recording.expires_at
                    else None,
                    recording.created_at.isoformat(),
                ),
            )
            conn.commit()
        return recording

    def get(self, session_id: str) -> Optional[Recording]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM recordings WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        return _row_to_recording(row) if row else None

    def delete(self, session_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                "DELETE FROM recordings WHERE session_id = ?", (session_id,)
            )
            conn.commit()
            return cur.rowcount > 0

    def list_expired(self, now: datetime) -> list[Recording]:
        cutoff = now.isoformat()
        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT * FROM recordings
                WHERE expires_at IS NOT NULL
                  AND expires_at <= ?
                ORDER BY expires_at ASC
                """,
                (cutoff,),
            ).fetchall()
        return [_row_to_recording(r) for r in rows]

    def list_for_user(
        self,
        user_id: str,
        *,
        limit: int = 20,
        offset: int = 0,
    ) -> list[tuple[Recording, Session]]:
        """JOIN sessions to filter by user_id (multi-tenant safety)."""
        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT
                    r.session_id        AS session_id,
                    r.audio_path        AS audio_path,
                    r.audio_format      AS audio_format,
                    r.audio_duration_seconds AS audio_duration_seconds,
                    r.audio_size_bytes  AS audio_size_bytes,
                    r.expires_at        AS expires_at,
                    r.created_at        AS created_at,
                    s.id                AS s_id,
                    s.user_id           AS s_user_id,
                    s.scenario          AS s_scenario,
                    s.title             AS s_title,
                    s.my_language       AS s_my_language,
                    s.other_language    AS s_other_language,
                    s.started_at        AS s_started_at,
                    s.ended_at          AS s_ended_at,
                    s.duration_seconds  AS s_duration_seconds,
                    s.is_recording      AS s_is_recording,
                    s.summary           AS s_summary,
                    s.action_items      AS s_action_items,
                    s.metadata          AS s_metadata,
                    s.deleted_at        AS s_deleted_at,
                    s.mode              AS s_mode
                FROM recordings r
                INNER JOIN sessions s ON s.id = r.session_id
                WHERE s.user_id = ?
                  AND s.deleted_at IS NULL
                ORDER BY r.created_at DESC
                LIMIT ? OFFSET ?
                """,
                (user_id, int(limit), int(offset)),
            ).fetchall()

        results: list[tuple[Recording, Session]] = []
        for row in rows:
            results.append((_row_to_recording(row), _row_to_session(row)))
        return results
