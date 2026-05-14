"""SQLite adapter for ``ShareLinksRepository`` (B7)."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from app.application.ports.share_links_repository import ShareLinksRepository
from app.domain.entities.share_link import ShareLink
from app.infrastructure.persistence.sqlite.db import get_conn


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    """Parse a TEXT column from SQLite back into a naive UTC datetime."""
    if not value:
        return None
    try:
        return datetime.fromisoformat(value)
    except ValueError:
        try:
            return datetime.strptime(value, "%Y-%m-%d %H:%M:%S")
        except ValueError:
            return None


def _utcnow_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _row_to_link(row) -> ShareLink:
    return ShareLink(
        id=row["id"],
        session_id=row["session_id"],
        user_id=row["user_id"],
        permissions=row["permissions"],
        expires_at=_parse_datetime(row["expires_at"]),
        revoked_at=_parse_datetime(row["revoked_at"]),
        view_count=int(row["view_count"] or 0),
        created_at=_parse_datetime(row["created_at"]) or _utcnow_naive(),
    )


class SQLiteShareLinksRepository(ShareLinksRepository):
    """SQLite-backed share-links store."""

    def create(self, link: ShareLink) -> ShareLink:
        with get_conn() as conn:
            conn.execute(
                """
                INSERT INTO share_links (
                    id, session_id, user_id, permissions,
                    expires_at, revoked_at, view_count, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    link.id,
                    link.session_id,
                    link.user_id,
                    link.permissions,
                    link.expires_at.isoformat() if link.expires_at else None,
                    link.revoked_at.isoformat() if link.revoked_at else None,
                    int(link.view_count),
                    link.created_at.isoformat(),
                ),
            )
            conn.commit()
        return link

    def get(self, link_id: str) -> Optional[ShareLink]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM share_links WHERE id = ?", (link_id,)
            ).fetchone()
        return _row_to_link(row) if row else None

    def list_for_session(
        self, session_id: str, user_id: str
    ) -> list[ShareLink]:
        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT * FROM share_links
                WHERE session_id = ? AND user_id = ?
                ORDER BY created_at DESC
                """,
                (session_id, user_id),
            ).fetchall()
        return [_row_to_link(r) for r in rows]

    def list_for_user(
        self, user_id: str, *, limit: int = 50, offset: int = 0
    ) -> list[ShareLink]:
        with get_conn() as conn:
            rows = conn.execute(
                """
                SELECT * FROM share_links
                WHERE user_id = ?
                ORDER BY created_at DESC
                LIMIT ? OFFSET ?
                """,
                (user_id, int(limit), int(offset)),
            ).fetchall()
        return [_row_to_link(r) for r in rows]

    def revoke(self, link_id: str, user_id: str) -> bool:
        """Owner-scoped + idempotent: only revokes if user_id matches AND
        the link is not already revoked. Returns True iff a row was updated."""
        now = _utcnow_naive().isoformat()
        with get_conn() as conn:
            cur = conn.execute(
                """
                UPDATE share_links
                SET revoked_at = ?
                WHERE id = ? AND user_id = ? AND revoked_at IS NULL
                """,
                (now, link_id, user_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def increment_view_count(self, link_id: str) -> None:
        """Atomic single-statement increment — race-safe across concurrent
        public reads. Silently no-ops if the link does not exist."""
        with get_conn() as conn:
            conn.execute(
                """
                UPDATE share_links
                SET view_count = view_count + 1
                WHERE id = ?
                """,
                (link_id,),
            )
            conn.commit()
