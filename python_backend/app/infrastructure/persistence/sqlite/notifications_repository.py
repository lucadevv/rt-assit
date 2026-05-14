"""SQLite implementation of NotificationsRepository (B8)."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any, Optional, cast

from app.application.ports.notifications_repository import (
    NotificationsRepository,
)
from app.domain.entities.notification import (
    Notification,
    NotificationChannel,
    NotificationType,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteNotificationsRepository(NotificationsRepository):
    def create(self, notification: Notification) -> Notification:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO notifications
                   (user_id, type, channel, title, body, metadata,
                    read_at, sent_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    notification.user_id,
                    notification.type,
                    notification.channel,
                    notification.title,
                    notification.body,
                    json.dumps(notification.metadata or {}),
                    _to_iso(notification.read_at),
                    _to_iso(notification.sent_at),
                ),
            )
            conn.commit()
            new_id = cur.lastrowid
            row = conn.execute(
                """SELECT id, user_id, type, channel, title, body, metadata,
                          read_at, sent_at, created_at
                   FROM notifications WHERE id = ?""",
                (new_id,),
            ).fetchone()
        return self._row_to_entity(row)

    def get(
        self, notification_id: int, user_id: str
    ) -> Optional[Notification]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT id, user_id, type, channel, title, body, metadata,
                          read_at, sent_at, created_at
                   FROM notifications WHERE id = ? AND user_id = ?""",
                (notification_id, user_id),
            ).fetchone()
        return self._row_to_entity(row) if row else None

    def list_for_user(
        self,
        user_id: str,
        *,
        unread_only: bool = False,
        limit: int = 50,
        offset: int = 0,
    ) -> list[Notification]:
        sql = (
            "SELECT id, user_id, type, channel, title, body, metadata, "
            "read_at, sent_at, created_at "
            "FROM notifications WHERE user_id = ?"
        )
        params: list[Any] = [user_id]
        if unread_only:
            sql += " AND read_at IS NULL"
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        with get_conn() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_entity(r) for r in rows]

    def count_unread(self, user_id: str) -> int:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT COUNT(*) AS n FROM notifications
                   WHERE user_id = ? AND read_at IS NULL""",
                (user_id,),
            ).fetchone()
        return int(row["n"]) if row else 0

    def mark_read(self, notification_id: int, user_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                """UPDATE notifications SET read_at = datetime('now')
                   WHERE id = ? AND user_id = ? AND read_at IS NULL""",
                (notification_id, user_id),
            )
            conn.commit()
            if cur.rowcount > 0:
                return True
            # Allow no-op (already read) to also count as success.
            row = conn.execute(
                "SELECT 1 FROM notifications WHERE id = ? AND user_id = ?",
                (notification_id, user_id),
            ).fetchone()
            return row is not None

    def mark_all_read(self, user_id: str) -> int:
        with get_conn() as conn:
            cur = conn.execute(
                """UPDATE notifications SET read_at = datetime('now')
                   WHERE user_id = ? AND read_at IS NULL""",
                (user_id,),
            )
            conn.commit()
            return cur.rowcount

    def mark_sent(self, notification_id: int) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE notifications SET sent_at = datetime('now')
                   WHERE id = ? AND sent_at IS NULL""",
                (notification_id,),
            )
            conn.commit()

    @staticmethod
    def _row_to_entity(row: sqlite3.Row) -> Notification:
        metadata_raw = row["metadata"]
        metadata: dict[str, Any] = (
            json.loads(metadata_raw) if metadata_raw else {}
        )
        return Notification(
            id=row["id"],
            user_id=row["user_id"],
            type=cast(NotificationType, row["type"]),
            channel=cast(NotificationChannel, row["channel"]),
            title=row["title"],
            body=row["body"],
            metadata=metadata,
            read_at=_parse_datetime(row["read_at"]),
            sent_at=_parse_datetime(row["sent_at"]),
            created_at=_parse_datetime(row["created_at"]),
        )


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    normalised = value.replace("T", " ")
    try:
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return datetime.fromisoformat(value)


def _to_iso(value: Optional[datetime]) -> Optional[str]:
    return value.strftime("%Y-%m-%d %H:%M:%S") if value else None
