"""SQLite implementation of SpeakersRepository (B1)."""
import sqlite3
from typing import Optional

from app.application.ports.speakers_repository import SpeakersRepository
from app.domain.entities.speaker import Speaker
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteSpeakersRepository(SpeakersRepository):
    def get_or_create(
        self,
        *,
        session_id: str,
        deepgram_speaker_id: int,
        is_user: bool = False,
    ) -> Speaker:
        with get_conn() as conn:
            # INSERT OR IGNORE relies on the UNIQUE(session_id, deepgram_speaker_id)
            conn.execute(
                """INSERT OR IGNORE INTO speakers
                   (session_id, deepgram_speaker_id, label, is_user)
                   VALUES (?, ?, ?, ?)""",
                (session_id, int(deepgram_speaker_id), None, 1 if is_user else 0),
            )
            conn.commit()
            row = conn.execute(
                """SELECT * FROM speakers
                   WHERE session_id = ? AND deepgram_speaker_id = ?""",
                (session_id, int(deepgram_speaker_id)),
            ).fetchone()
        if row is None:
            raise RuntimeError(
                f"failed to upsert speaker {deepgram_speaker_id} for {session_id}"
            )
        return _row_to_speaker(row)

    def get_by_deepgram_id(
        self, *, session_id: str, deepgram_speaker_id: int
    ) -> Optional[Speaker]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM speakers
                   WHERE session_id = ? AND deepgram_speaker_id = ?""",
                (session_id, int(deepgram_speaker_id)),
            ).fetchone()
        return _row_to_speaker(row) if row else None

    def rename(
        self,
        *,
        session_id: str,
        deepgram_speaker_id: int,
        label: Optional[str],
    ) -> Speaker:
        with get_conn() as conn:
            conn.execute(
                """UPDATE speakers SET label = ?
                   WHERE session_id = ? AND deepgram_speaker_id = ?""",
                (label, session_id, int(deepgram_speaker_id)),
            )
            conn.commit()
            row = conn.execute(
                """SELECT * FROM speakers
                   WHERE session_id = ? AND deepgram_speaker_id = ?""",
                (session_id, int(deepgram_speaker_id)),
            ).fetchone()
        if row is None:
            raise RuntimeError(f"speaker {deepgram_speaker_id} not found")
        return _row_to_speaker(row)

    def upsert_label(
        self,
        *,
        session_id: str,
        deepgram_speaker_id: int,
        label: Optional[str],
        is_user: bool = False,
    ) -> Speaker:
        """Insert-or-update a speaker label (B3).

        Single round-trip via INSERT ... ON CONFLICT DO UPDATE. If the row
        doesn't exist yet (e.g. the user labels a speaker that hasn't
        spoken yet, or merges multiple deepgram ids before they've all
        been seen), it is created. ``is_user`` is preserved on conflict
        because rename should not flip an existing user/non-user flag."""
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO speakers
                       (session_id, deepgram_speaker_id, label, is_user)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(session_id, deepgram_speaker_id)
                   DO UPDATE SET label = excluded.label""",
                (
                    session_id,
                    int(deepgram_speaker_id),
                    label,
                    1 if is_user else 0,
                ),
            )
            conn.commit()
            row = conn.execute(
                """SELECT * FROM speakers
                   WHERE session_id = ? AND deepgram_speaker_id = ?""",
                (session_id, int(deepgram_speaker_id)),
            ).fetchone()
        if row is None:
            raise RuntimeError(
                f"failed to upsert speaker {deepgram_speaker_id} for {session_id}"
            )
        return _row_to_speaker(row)

    def list_for_session(self, session_id: str) -> list[Speaker]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM speakers WHERE session_id = ?
                   ORDER BY deepgram_speaker_id ASC""",
                (session_id,),
            ).fetchall()
        return [_row_to_speaker(r) for r in rows]


def _row_to_speaker(row: sqlite3.Row) -> Speaker:
    return Speaker(
        id=row["id"],
        session_id=row["session_id"],
        deepgram_speaker_id=row["deepgram_speaker_id"],
        label=row["label"],
        is_user=bool(row["is_user"]),
    )
