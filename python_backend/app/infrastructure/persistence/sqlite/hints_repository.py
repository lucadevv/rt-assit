"""SQLite implementation of HintsRepository (B1)."""
import sqlite3
from typing import Optional

from app.application.ports.hints_repository import HintsRepository
from app.domain.entities.hint import Hint
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteHintsRepository(HintsRepository):
    def append(
        self,
        *,
        session_id: str,
        content: str,
        timestamp_ms: int,
        related_transcript_id: Optional[int] = None,
    ) -> Hint:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO hints
                   (session_id, related_transcript_id, content, timestamp_ms)
                   VALUES (?, ?, ?, ?)""",
                (session_id, related_transcript_id, content, int(timestamp_ms)),
            )
            conn.commit()
            new_id = cur.lastrowid
            if new_id is None:
                raise RuntimeError("failed to insert hint")
            row = conn.execute(
                "SELECT * FROM hints WHERE id = ?", (int(new_id),)
            ).fetchone()
        if row is None:
            raise RuntimeError("inserted hint missing")
        return _row_to_hint(row)

    def get_for_session(self, session_id: str) -> list[Hint]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM hints WHERE session_id = ?
                   ORDER BY timestamp_ms ASC, id ASC""",
                (session_id,),
            ).fetchall()
        return [_row_to_hint(r) for r in rows]


def _row_to_hint(row: sqlite3.Row) -> Hint:
    return Hint(
        id=row["id"],
        session_id=row["session_id"],
        related_transcript_id=row["related_transcript_id"],
        content=row["content"],
        timestamp_ms=row["timestamp_ms"],
    )
