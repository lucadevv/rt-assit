"""SQLite implementation of TranscriptCorrectionsRepository (B2)."""
import sqlite3
from datetime import datetime
from typing import Optional

from app.application.ports.transcript_corrections_repository import (
    TranscriptCorrectionsRepository,
)
from app.domain.entities.transcript_correction import TranscriptCorrection
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteTranscriptCorrectionsRepository(TranscriptCorrectionsRepository):
    def add(
        self,
        *,
        transcript_id: int,
        user_id: str,
        original_content: str,
        corrected_content: str,
        correction_reason: Optional[str],
    ) -> TranscriptCorrection:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO transcript_corrections
                   (transcript_id, user_id, original_content,
                    corrected_content, correction_reason)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    int(transcript_id),
                    user_id,
                    original_content,
                    corrected_content,
                    correction_reason,
                ),
            )
            conn.commit()
            new_id = cur.lastrowid
            if new_id is None:
                raise RuntimeError("failed to insert transcript_correction")
            row = conn.execute(
                "SELECT * FROM transcript_corrections WHERE id = ?",
                (int(new_id),),
            ).fetchone()
        if row is None:
            raise RuntimeError("inserted correction missing")
        return _row_to_correction(row)

    def list_for_transcript(
        self, transcript_id: int
    ) -> list[TranscriptCorrection]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM transcript_corrections
                   WHERE transcript_id = ?
                   ORDER BY datetime(created_at) ASC, id ASC""",
                (int(transcript_id),),
            ).fetchall()
        return [_row_to_correction(r) for r in rows]


def _row_to_correction(row: sqlite3.Row) -> TranscriptCorrection:
    raw_created = row["created_at"]
    if isinstance(raw_created, datetime):
        created_at = raw_created
    else:
        # SQLite stores TEXT for datetime('now') — parse defensively.
        try:
            created_at = datetime.fromisoformat(str(raw_created).replace("Z", "+00:00"))
        except ValueError:
            # Last-ditch: treat unparseable as "now-ish" wall clock.
            created_at = datetime.utcnow()
    return TranscriptCorrection(
        id=row["id"],
        transcript_id=row["transcript_id"],
        user_id=row["user_id"],
        original_content=row["original_content"],
        corrected_content=row["corrected_content"],
        correction_reason=row["correction_reason"],
        created_at=created_at,
    )
