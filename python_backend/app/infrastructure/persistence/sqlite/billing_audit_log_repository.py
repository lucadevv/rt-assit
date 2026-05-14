"""SQLite implementation of BillingAuditLogRepository."""
from __future__ import annotations

import sqlite3
from typing import Any, cast

from app.application.ports.billing_audit_log_repository import (
    BillingAuditLogRepository,
)
from app.domain.entities.billing_audit_log import ActorType, BillingAuditLog
from app.infrastructure.persistence.sqlite._billing_helpers import (
    dumps_json,
    loads_json,
    parse_dt,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteBillingAuditLogRepository(BillingAuditLogRepository):
    def append(
        self,
        *,
        user_id: str,
        action: str,
        actor: ActorType,
        actor_id: str | None,
        metadata: dict[str, Any] | None = None,
    ) -> BillingAuditLog:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO billing_audit_log
                   (user_id, action, actor, actor_id, metadata)
                   VALUES (?, ?, ?, ?, ?)""",
                (
                    user_id,
                    action,
                    actor,
                    actor_id,
                    dumps_json(metadata or {}),
                ),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM billing_audit_log WHERE id = ?",
                (cur.lastrowid,),
            ).fetchone()
        if row is None:
            raise RuntimeError("billing_audit_log insert failed")
        return self._row(row)

    def list_for_user(
        self, user_id: str, *, limit: int = 100
    ) -> list[BillingAuditLog]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM billing_audit_log
                   WHERE user_id = ?
                   ORDER BY datetime(created_at) DESC LIMIT ?""",
                (user_id, limit),
            ).fetchall()
        return [self._row(r) for r in rows]

    @staticmethod
    def _row(row: sqlite3.Row) -> BillingAuditLog:
        return BillingAuditLog(
            id=int(row["id"]),
            user_id=row["user_id"],
            action=row["action"],
            actor=cast(ActorType, row["actor"]),
            actor_id=row["actor_id"],
            metadata=loads_json(row["metadata"], {}),
            created_at=parse_dt(row["created_at"]),
        )
