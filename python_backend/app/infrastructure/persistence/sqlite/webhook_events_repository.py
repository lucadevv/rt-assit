"""SQLite implementation of WebhookEventsRepository.

Idempotency: uses INSERT OR IGNORE on the provider's event id (PK)."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Optional, cast

from app.application.ports.webhook_events_repository import (
    WebhookEventsRepository,
)
from app.domain.entities.webhook_event import WebhookEvent, WebhookStatus
from app.infrastructure.persistence.sqlite._billing_helpers import (
    dumps_json,
    fmt_dt,
    loads_json,
    parse_dt,
    parse_dt_required,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteWebhookEventsRepository(WebhookEventsRepository):
    def insert_or_skip(
        self,
        *,
        event_id: str,
        provider: str,
        event_type: str,
        payload: dict[str, Any],
        signature: Optional[str],
    ) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT OR IGNORE INTO webhook_events
                   (id, provider, event_type, payload, signature, status)
                   VALUES (?, ?, ?, ?, ?, 'received')""",
                (event_id, provider, event_type, dumps_json(payload), signature),
            )
            conn.commit()
        return cur.rowcount > 0

    def get(self, event_id: str) -> Optional[WebhookEvent]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM webhook_events WHERE id = ?", (event_id,)
            ).fetchone()
        return self._row(row) if row else None

    def mark_processed(
        self, event_id: str, *, processed_at: datetime
    ) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE webhook_events
                   SET status = 'processed', processed_at = ?,
                       error_message = NULL
                   WHERE id = ?""",
                (fmt_dt(processed_at), event_id),
            )
            conn.commit()

    def mark_failed(
        self, event_id: str, *, error_message: str
    ) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE webhook_events
                   SET status = 'failed', error_message = ?,
                       retry_count = retry_count + 1
                   WHERE id = ?""",
                (error_message, event_id),
            )
            conn.commit()

    def update_status(
        self, event_id: str, *, status: WebhookStatus
    ) -> None:
        with get_conn() as conn:
            conn.execute(
                "UPDATE webhook_events SET status = ? WHERE id = ?",
                (status, event_id),
            )
            conn.commit()

    @staticmethod
    def _row(row: sqlite3.Row) -> WebhookEvent:
        return WebhookEvent(
            id=row["id"],
            provider=row["provider"],
            event_type=row["event_type"],
            payload=loads_json(row["payload"], {}),
            signature=row["signature"],
            status=cast(WebhookStatus, row["status"]),
            error_message=row["error_message"],
            retry_count=int(row["retry_count"] or 0),
            received_at=parse_dt_required(row["received_at"]),
            processed_at=parse_dt(row["processed_at"]),
        )
