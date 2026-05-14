"""SQLite implementation of TranscriptsRepository (B1, extended in B2).

Search uses FTS5 with sanitised query string (avoids syntax errors on
special chars typed by users). B2 adds:

- ``get_by_id(id)`` — primary-key lookup, used by the edit-transcript flow.
- ``update_content(id, new)`` — replaces transcript text; the
  ``transcripts_au`` trigger in ``db.py`` keeps the FTS5 index in sync.
- ``search_for_user(user_id, query, session_id?)`` — multi-tenant search
  that JOINs through ``sessions`` so transcripts cannot leak across
  tenants. ``ORDER BY rank`` picks BM25-best matches first."""
import re
import sqlite3
from typing import Any, Optional

from app.application.ports.transcripts_repository import TranscriptsRepository
from app.domain.entities.persisted_transcript import PersistedTranscript
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteTranscriptsRepository(TranscriptsRepository):
    def append(
        self,
        *,
        session_id: str,
        content: str,
        is_final: bool,
        timestamp_ms: int,
        speaker_id: Optional[int] = None,
        deepgram_speaker: Optional[int] = None,
        language: Optional[str] = None,
        confidence: Optional[float] = None,
    ) -> PersistedTranscript:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO transcripts
                   (session_id, speaker_id, deepgram_speaker, content,
                    is_final, timestamp_ms, language, confidence)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    session_id,
                    speaker_id,
                    deepgram_speaker,
                    content,
                    1 if is_final else 0,
                    int(timestamp_ms),
                    language,
                    confidence,
                ),
            )
            conn.commit()
            new_id = cur.lastrowid
            if new_id is None:
                raise RuntimeError("failed to insert transcript")
            row = conn.execute(
                "SELECT * FROM transcripts WHERE id = ?", (int(new_id),)
            ).fetchone()
        if row is None:
            raise RuntimeError("inserted transcript missing")
        return _row_to_transcript(row)

    def get_for_session(
        self,
        *,
        session_id: str,
        only_final: bool = False,
        limit: Optional[int] = None,
        offset: int = 0,
    ) -> list[PersistedTranscript]:
        query = "SELECT * FROM transcripts WHERE session_id = ?"
        params: list[Any] = [session_id]
        if only_final:
            query += " AND is_final = 1"
        query += " ORDER BY timestamp_ms ASC, id ASC"
        if limit is not None:
            query += " LIMIT ? OFFSET ?"
            params.extend([int(limit), int(offset)])

        with get_conn() as conn:
            rows = conn.execute(query, params).fetchall()
        return [_row_to_transcript(r) for r in rows]

    def get_by_id(self, transcript_id: int) -> Optional[PersistedTranscript]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM transcripts WHERE id = ?", (int(transcript_id),)
            ).fetchone()
        return _row_to_transcript(row) if row else None

    def update_content(
        self, transcript_id: int, new_content: str
    ) -> PersistedTranscript:
        with get_conn() as conn:
            conn.execute(
                "UPDATE transcripts SET content = ? WHERE id = ?",
                (new_content, int(transcript_id)),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM transcripts WHERE id = ?", (int(transcript_id),)
            ).fetchone()
        if row is None:
            raise RuntimeError(f"transcript {transcript_id} disappeared after UPDATE")
        return _row_to_transcript(row)

    def search(
        self,
        *,
        session_id: str,
        query: str,
        limit: int = 50,
    ) -> list[PersistedTranscript]:
        sanitised = _sanitise_fts(query)
        if not sanitised:
            return []
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT t.* FROM transcripts t
                   JOIN transcripts_fts f ON f.rowid = t.id
                   WHERE t.session_id = ? AND transcripts_fts MATCH ?
                   ORDER BY t.timestamp_ms ASC, t.id ASC
                   LIMIT ?""",
                (session_id, sanitised, int(limit)),
            ).fetchall()
        return [_row_to_transcript(r) for r in rows]

    def search_for_user(
        self,
        *,
        user_id: str,
        query: str,
        session_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[PersistedTranscript]:
        sanitised = _sanitise_fts(query)
        if not sanitised:
            return []

        sql = """
            SELECT t.* FROM transcripts_fts fts
            JOIN transcripts t ON t.id = fts.rowid
            JOIN sessions s ON s.id = t.session_id
            WHERE transcripts_fts MATCH ?
              AND s.user_id = ?
              AND s.deleted_at IS NULL
        """
        params: list[Any] = [sanitised, user_id]
        if session_id is not None:
            sql += " AND t.session_id = ?"
            params.append(session_id)
        sql += " ORDER BY rank LIMIT ?"
        params.append(int(limit))

        with get_conn() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [_row_to_transcript(r) for r in rows]

    def count_for_session(self, session_id: str) -> int:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT COUNT(*) AS n FROM transcripts WHERE session_id = ?",
                (session_id,),
            ).fetchone()
        return int(row["n"]) if row else 0


def _row_to_transcript(row: sqlite3.Row) -> PersistedTranscript:
    return PersistedTranscript(
        id=row["id"],
        session_id=row["session_id"],
        speaker_id=row["speaker_id"],
        deepgram_speaker=row["deepgram_speaker"],
        content=row["content"],
        is_final=bool(row["is_final"]),
        timestamp_ms=row["timestamp_ms"],
        language=row["language"],
        confidence=row["confidence"],
    )


_FTS_TOKEN_RE = re.compile(r"[A-Za-z0-9áéíóúÁÉÍÓÚñÑüÜ]+", re.UNICODE)


def _sanitise_fts(query: str) -> str:
    """Wrap each token in quotes — FTS5 MATCH treats unquoted special chars
    as operators (AND, OR, NEAR, NOT). Spanish diacritics are preserved."""
    tokens = _FTS_TOKEN_RE.findall(query or "")
    if not tokens:
        return ""
    return " ".join(f'"{t}"' for t in tokens)
