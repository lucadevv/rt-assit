"""SQLite implementation of APIKeysRepository (B8 — BYOK).

This repo NEVER decrypts. The ciphertext column is exposed only via
``get_active_ciphertext`` which is consumed inside the application layer
by ``GetActiveAPIKeyForProviderUseCase``. The public ``list_for_user``
returns redacted entities with hint only — guaranteed by the
``_row_to_entity`` shape that simply doesn't include ``key_encrypted``."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional, cast

from app.application.ports.api_keys_repository import APIKeysRepository
from app.domain.entities.api_key import APIKey, APIKeyProvider
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteAPIKeysRepository(APIKeysRepository):
    def create(
        self,
        *,
        user_id: str,
        provider: str,
        key_encrypted: str,
        key_hint: str,
    ) -> APIKey:
        # UNIQUE(user_id, provider) — replace on conflict.
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO api_keys
                   (user_id, provider, key_encrypted, key_hint, is_active)
                   VALUES (?, ?, ?, ?, 1)
                   ON CONFLICT(user_id, provider) DO UPDATE SET
                       key_encrypted = excluded.key_encrypted,
                       key_hint = excluded.key_hint,
                       is_active = 1,
                       last_used_at = NULL""",
                (user_id, provider, key_encrypted, key_hint),
            )
            conn.commit()
            row = conn.execute(
                """SELECT id, user_id, provider, key_hint, is_active,
                          last_used_at, created_at
                   FROM api_keys
                   WHERE user_id = ? AND provider = ?""",
                (user_id, provider),
            ).fetchone()
        return self._row_to_entity(row)

    def get(self, api_key_id: int, user_id: str) -> Optional[APIKey]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT id, user_id, provider, key_hint, is_active,
                          last_used_at, created_at
                   FROM api_keys
                   WHERE id = ? AND user_id = ?""",
                (api_key_id, user_id),
            ).fetchone()
        return self._row_to_entity(row) if row else None

    def get_active_ciphertext(
        self, user_id: str, provider: str
    ) -> Optional[str]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT key_encrypted FROM api_keys
                   WHERE user_id = ? AND provider = ? AND is_active = 1""",
                (user_id, provider),
            ).fetchone()
        return row["key_encrypted"] if row else None

    def list_for_user(self, user_id: str) -> list[APIKey]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT id, user_id, provider, key_hint, is_active,
                          last_used_at, created_at
                   FROM api_keys
                   WHERE user_id = ?
                   ORDER BY created_at DESC""",
                (user_id,),
            ).fetchall()
        return [self._row_to_entity(r) for r in rows]

    def delete(self, api_key_id: int, user_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                "DELETE FROM api_keys WHERE id = ? AND user_id = ?",
                (api_key_id, user_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def touch_last_used(self, user_id: str, provider: str) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE api_keys
                   SET last_used_at = datetime('now')
                   WHERE user_id = ? AND provider = ?""",
                (user_id, provider),
            )
            conn.commit()

    @staticmethod
    def _row_to_entity(row: sqlite3.Row) -> APIKey:
        return APIKey(
            id=row["id"],
            user_id=row["user_id"],
            provider=cast(APIKeyProvider, row["provider"]),
            key_hint=row["key_hint"],
            is_active=bool(row["is_active"]),
            last_used_at=_parse_datetime(row["last_used_at"]),
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
