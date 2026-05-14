"""SQLite implementation of UsersRepository."""
import sqlite3
from datetime import datetime
from typing import Optional, cast

from app.application.ports.users_repository import UsersRepository
from app.domain.entities.user import User, UserTier
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteUsersRepository(UsersRepository):
    """SQLite-backed users repository. Translates rows to ``User`` entities."""

    def get_by_id(self, user_id: str) -> Optional[User]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
        return self._row_to_user(row) if row else None

    def upsert(
        self,
        *,
        user_id: str,
        email: str,
        name: Optional[str],
        avatar_url: Optional[str],
    ) -> User:
        # SQLite UPSERT — keep the existing tier/language_preferred on conflict.
        # Update mutable identity fields (email/name/avatar) only when a new
        # value is provided. updated_at always bumped on conflict.
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO users (id, email, name, avatar_url)
                   VALUES (?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET
                       email = excluded.email,
                       name = COALESCE(excluded.name, users.name),
                       avatar_url = COALESCE(excluded.avatar_url, users.avatar_url),
                       updated_at = datetime('now')""",
                (user_id, email, name, avatar_url),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError(f"failed to upsert user {user_id}")
        return self._row_to_user(row)

    def update_settings(
        self,
        *,
        user_id: str,
        name: Optional[str],
        language_preferred: Optional[str],
    ) -> User:
        # Build the SET clause dynamically so unset fields stay untouched.
        fields: list[str] = []
        params: list[object] = []
        if name is not None:
            fields.append("name = ?")
            params.append(name)
        if language_preferred is not None:
            fields.append("language_preferred = ?")
            params.append(language_preferred)

        if not fields:
            # Nothing to update — return the current entity.
            existing = self.get_by_id(user_id)
            if existing is None:
                raise RuntimeError(f"user {user_id} not found")
            return existing

        fields.append("updated_at = datetime('now')")
        params.append(user_id)

        with get_conn() as conn:
            conn.execute(
                f"UPDATE users SET {', '.join(fields)} WHERE id = ?", params
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError(f"user {user_id} not found")
        return self._row_to_user(row)

    def update_tier(self, *, user_id: str, tier: UserTier) -> User:
        with get_conn() as conn:
            conn.execute(
                """UPDATE users
                   SET tier = ?, updated_at = datetime('now')
                   WHERE id = ?""",
                (tier, user_id),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError(f"user {user_id} not found")
        return self._row_to_user(row)

    def update_name(self, *, user_id: str, name: str) -> User:
        with get_conn() as conn:
            conn.execute(
                """UPDATE users
                   SET name = ?, updated_at = datetime('now')
                   WHERE id = ?""",
                (name, user_id),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM users WHERE id = ?", (user_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError(f"user {user_id} not found")
        return self._row_to_user(row)

    def delete(self, user_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute("DELETE FROM users WHERE id = ?", (user_id,))
            conn.commit()
            return cur.rowcount > 0

    @staticmethod
    def _row_to_user(row: sqlite3.Row) -> User:
        return User(
            id=row["id"],
            email=row["email"],
            name=row["name"],
            avatar_url=row["avatar_url"],
            tier=cast(UserTier, row["tier"]),
            language_preferred=row["language_preferred"],
            created_at=_parse_datetime(row["created_at"]),
            updated_at=_parse_datetime(row["updated_at"]),
        )


def _parse_datetime(value: Optional[str]) -> datetime:
    """SQLite datetime('now') returns 'YYYY-MM-DD HH:MM:SS'. Parse to dt."""
    if value is None:
        return datetime.utcnow()
    # Accept both space and 'T' separators.
    normalised = value.replace("T", " ")
    try:
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        # Fallback for ISO with microseconds.
        return datetime.fromisoformat(value)
