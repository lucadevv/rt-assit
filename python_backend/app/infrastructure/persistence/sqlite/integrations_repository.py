"""SQLite implementation of IntegrationsRepository (B4 placeholder).

Only read operations are wired — list_for_user + get_by_provider — to
serve the GET /api/integrations endpoint. credentials_encrypted is
NEVER read into the domain entity; it lives in DB only for future OAuth
flows (F-future).
"""
import json
import sqlite3
from datetime import datetime
from typing import Any, Optional, cast

from app.application.ports.integrations_repository import (
    IntegrationsRepository,
)
from app.domain.entities.integration import (
    Integration,
    IntegrationProvider,
    IntegrationStatus,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteIntegrationsRepository(IntegrationsRepository):
    """SQLite-backed integrations repository (read-only for now)."""

    def list_for_user(self, user_id: str) -> list[Integration]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT id, user_id, provider, status, metadata,
                          connected_at, disconnected_at
                   FROM integrations
                   WHERE user_id = ?
                   ORDER BY id ASC""",
                (user_id,),
            ).fetchall()
        return [self._row_to_integration(r) for r in rows]

    def get_by_provider(
        self, user_id: str, provider: str
    ) -> Optional[Integration]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT id, user_id, provider, status, metadata,
                          connected_at, disconnected_at
                   FROM integrations
                   WHERE user_id = ? AND provider = ?""",
                (user_id, provider),
            ).fetchone()
        return self._row_to_integration(row) if row else None

    @staticmethod
    def _row_to_integration(row: sqlite3.Row) -> Integration:
        raw_metadata = row["metadata"]
        metadata: dict[str, Any] = (
            json.loads(raw_metadata) if raw_metadata else {}
        )
        return Integration(
            id=row["id"],
            user_id=row["user_id"],
            provider=cast(IntegrationProvider, row["provider"]),
            status=cast(IntegrationStatus, row["status"]),
            metadata=metadata,
            connected_at=_parse_datetime(row["connected_at"]),
            disconnected_at=_parse_datetime(row["disconnected_at"]),
        )


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    normalised = value.replace("T", " ")
    try:
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return datetime.fromisoformat(value)
