"""SQLite implementation of OAuthTokenStorage (Meeting Frame foundation).

Encrypts ``access_token`` + ``refresh_token`` at rest via Fernet. The
constructor takes ``db_path`` and ``fernet_key`` directly (rather than
using the global ``get_conn``) so the OAuth subsystem can be tested with
isolated temp DBs and rotated keys without touching the rest of the app."""
from __future__ import annotations

import sqlite3
from typing import Optional, cast

from cryptography.fernet import Fernet

from app.application.ports.oauth_token_storage import OAuthTokenStorage
from app.domain.entities.oauth_credential import (
    OAuthCredential,
    OAuthProviderId,
)


class SqliteOAuthRepository(OAuthTokenStorage):
    def __init__(self, db_path: str, fernet_key: bytes) -> None:
        self._db_path = db_path
        self._fernet = Fernet(fernet_key)

    # ----- public API ------------------------------------------------------

    def save(self, credential: OAuthCredential) -> None:
        access_enc = self._encrypt(credential.access_token)
        refresh_enc = self._encrypt(credential.refresh_token)
        with self._connect() as conn:
            conn.execute(
                """INSERT INTO oauth_credentials
                   (id, user_id, provider, access_token_enc, refresh_token_enc,
                    expires_at, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(user_id, provider) DO UPDATE SET
                       access_token_enc = excluded.access_token_enc,
                       refresh_token_enc = excluded.refresh_token_enc,
                       expires_at = excluded.expires_at,
                       updated_at = excluded.updated_at""",
                (
                    credential.id,
                    credential.user_id,
                    credential.provider,
                    access_enc,
                    refresh_enc,
                    credential.expires_at,
                    credential.created_at,
                    credential.updated_at,
                ),
            )
            conn.commit()

    def get(
        self, user_id: str, provider: OAuthProviderId
    ) -> Optional[OAuthCredential]:
        with self._connect() as conn:
            row = conn.execute(
                """SELECT id, user_id, provider, access_token_enc,
                          refresh_token_enc, expires_at, created_at, updated_at
                   FROM oauth_credentials
                   WHERE user_id = ? AND provider = ?""",
                (user_id, provider),
            ).fetchone()
        return self._row_to_entity(row) if row else None

    def delete(self, user_id: str, provider: OAuthProviderId) -> None:
        with self._connect() as conn:
            conn.execute(
                "DELETE FROM oauth_credentials WHERE user_id = ? AND provider = ?",
                (user_id, provider),
            )
            conn.commit()

    def list_for_user(self, user_id: str) -> list[OAuthCredential]:
        with self._connect() as conn:
            rows = conn.execute(
                """SELECT id, user_id, provider, access_token_enc,
                          refresh_token_enc, expires_at, created_at, updated_at
                   FROM oauth_credentials
                   WHERE user_id = ?
                   ORDER BY created_at DESC""",
                (user_id,),
            ).fetchall()
        return [self._row_to_entity(r) for r in rows]

    # ----- internal helpers -----------------------------------------------

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON")
        return conn

    def _encrypt(self, value: str) -> bytes:
        return self._fernet.encrypt(value.encode("utf-8"))

    def _decrypt(self, value: bytes) -> str:
        return self._fernet.decrypt(value).decode("utf-8")

    def _row_to_entity(self, row: sqlite3.Row) -> OAuthCredential:
        return OAuthCredential(
            id=row["id"],
            user_id=row["user_id"],
            provider=cast(OAuthProviderId, row["provider"]),
            access_token=self._decrypt(row["access_token_enc"]),
            refresh_token=self._decrypt(row["refresh_token_enc"]),
            expires_at=row["expires_at"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )
