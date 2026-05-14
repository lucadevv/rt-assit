"""SQLite implementation of SessionTagsRepository (B1)."""
from app.application.ports.session_tags_repository import SessionTagsRepository
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteSessionTagsRepository(SessionTagsRepository):
    def add_tag(self, *, session_id: str, tag: str) -> None:
        with get_conn() as conn:
            conn.execute(
                """INSERT OR IGNORE INTO session_tags (session_id, tag)
                   VALUES (?, ?)""",
                (session_id, tag),
            )
            conn.commit()

    def remove_tag(self, *, session_id: str, tag: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                "DELETE FROM session_tags WHERE session_id = ? AND tag = ?",
                (session_id, tag),
            )
            conn.commit()
            return cur.rowcount > 0

    def list_tags(self, session_id: str) -> list[str]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT tag FROM session_tags WHERE session_id = ? ORDER BY tag",
                (session_id,),
            ).fetchall()
        return [r["tag"] for r in rows]
