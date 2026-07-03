"""SQLite implementation of ``RefreshTokensRepository`` (Auth Fase A).

Schema lives in ``db.py`` (idempotent ``CREATE TABLE IF NOT EXISTS``).
All datetime columns are stored as ISO-8601 UTC strings to match the
rest of the codebase's SQLite-text convention (sortable + grep-friendly).
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional

from app.application.ports.refresh_tokens_repository import (
    RefreshTokensRepository,
)
from app.domain.entities.refresh_token import RefreshToken
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteRefreshTokensRepository(RefreshTokensRepository):
    """SQLite-backed refresh-token store.

    Datetime columns are persisted as ISO-8601 strings (``isoformat()``)
    so they're human-readable in sqlite3 CLI and survive cross-version
    sqlite3 driver upgrades without binary-format gotchas."""

    def create(self, token: RefreshToken) -> RefreshToken:
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO refresh_tokens
                   (id, user_id, expires_at, revoked_at, user_agent, ip, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    token.id,
                    token.user_id,
                    token.expires_at.isoformat(),
                    token.revoked_at.isoformat() if token.revoked_at else None,
                    token.user_agent,
                    token.ip,
                    token.created_at.isoformat(),
                ),
            )
            conn.commit()
        return token

    def get_by_id(self, token_id: str) -> Optional[RefreshToken]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT id, user_id, expires_at, revoked_at,
                          user_agent, ip, created_at
                   FROM refresh_tokens WHERE id = ?""",
                (token_id,),
            ).fetchone()
        return self._row_to_entity(row) if row else None

    def revoke(self, token_id: str) -> None:
        # Idempotent: setting revoked_at on an already-revoked row is
        # harmless (and saves a roundtrip vs reading first).
        with get_conn() as conn:
            conn.execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL",
                (datetime.utcnow().isoformat(), token_id),
            )
            conn.commit()

    def revoke_all_for_user(self, user_id: str) -> None:
        with get_conn() as conn:
            conn.execute(
                "UPDATE refresh_tokens SET revoked_at = ? WHERE user_id = ? AND revoked_at IS NULL",
                (datetime.utcnow().isoformat(), user_id),
            )
            conn.commit()

    def rotate(self, old_id: str, new_token: RefreshToken) -> RefreshToken:
        # Single ``BEGIN IMMEDIATE`` transaction. Either both writes
        # commit or both roll back — closes the lockout-on-partial-fail
        # window described in the port docstring.
        with get_conn(begin_transaction=True) as conn:
            conn.execute(
                "UPDATE refresh_tokens SET revoked_at = ? "
                "WHERE id = ? AND revoked_at IS NULL",
                (datetime.utcnow().isoformat(), old_id),
            )
            conn.execute(
                """INSERT INTO refresh_tokens
                   (id, user_id, expires_at, revoked_at, user_agent, ip, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    new_token.id,
                    new_token.user_id,
                    new_token.expires_at.isoformat(),
                    new_token.revoked_at.isoformat() if new_token.revoked_at else None,
                    new_token.user_agent,
                    new_token.ip,
                    new_token.created_at.isoformat(),
                ),
            )
        return new_token

    def prune_expired(self) -> int:
        """Delete rows whose ``expires_at`` is in the past. Returns the
        count of deleted rows. Safe to call on a hot DB — the index on
        ``expires_at`` makes the WHERE clause cheap."""
        with get_conn() as conn:
            cur = conn.execute(
                "DELETE FROM refresh_tokens WHERE expires_at < ?",
                (datetime.utcnow().isoformat(),),
            )
            conn.commit()
            return cur.rowcount or 0

    @staticmethod
    def _row_to_entity(row: sqlite3.Row) -> RefreshToken:
        return RefreshToken(
            id=row["id"],
            user_id=row["user_id"],
            expires_at=_parse_iso(row["expires_at"]),
            revoked_at=_parse_iso(row["revoked_at"]) if row["revoked_at"] else None,
            user_agent=row["user_agent"],
            ip=row["ip"],
            created_at=_parse_iso(row["created_at"]),
        )


def _parse_iso(value: str) -> datetime:
    """Parse an ISO-8601 string into a naive UTC ``datetime``.

    All rows are written via ``datetime.utcnow().isoformat()`` so they
    never carry a timezone suffix; we therefore use ``fromisoformat``
    directly without normalisation."""
    return datetime.fromisoformat(value)
