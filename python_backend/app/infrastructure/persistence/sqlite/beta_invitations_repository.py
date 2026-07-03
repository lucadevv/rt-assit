"""SQLite implementation of ``BetaInvitationsRepository``.

Schema lives in ``db.py``. Datetime columns are stored as ISO-8601 UTC
strings to match the rest of the codebase's SQLite-text convention.

``last_login`` is approximated by the MAX ``created_at`` over the
``refresh_tokens`` table — every successful login creates one row, so
that timestamp is the closest signal we have to "this user actually
came back". Cheap because ``refresh_tokens`` already indexes
``user_id``."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional

from app.application.ports.beta_invitations_repository import (
    BetaInvitationsRepository,
)
from app.domain.entities.beta_invitation import BetaInvitation
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteBetaInvitationsRepository(BetaInvitationsRepository):
    def create(self, invitation: BetaInvitation) -> BetaInvitation:
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO beta_invitations
                   (id, email, user_id, invited_at, email_sent_at,
                    invited_by_user_id)
                   VALUES (?, ?, ?, ?, ?, ?)""",
                (
                    invitation.id,
                    invitation.email,
                    invitation.user_id,
                    invitation.invited_at.isoformat(),
                    invitation.email_sent_at.isoformat()
                    if invitation.email_sent_at
                    else None,
                    invitation.invited_by_user_id,
                ),
            )
            conn.commit()
        return invitation

    def list(self, limit: int = 100) -> list[BetaInvitation]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT id, email, user_id, invited_at, email_sent_at,
                          invited_by_user_id
                   FROM beta_invitations
                   ORDER BY invited_at DESC
                   LIMIT ?""",
                (limit,),
            ).fetchall()
        return [self._row_to_entity(r) for r in rows]

    def mark_email_sent(self, invitation_id: str) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE beta_invitations
                   SET email_sent_at = ?
                   WHERE id = ? AND email_sent_at IS NULL""",
                (datetime.utcnow().isoformat(), invitation_id),
            )
            conn.commit()

    def list_user_last_login_map(
        self, user_ids: list[str]
    ) -> dict[str, Optional[str]]:
        if not user_ids:
            return {}
        placeholders = ",".join("?" * len(user_ids))
        with get_conn() as conn:
            rows = conn.execute(
                f"""SELECT user_id, MAX(created_at) AS last_login
                    FROM refresh_tokens
                    WHERE user_id IN ({placeholders})
                    GROUP BY user_id""",
                tuple(user_ids),
            ).fetchall()
        out: dict[str, Optional[str]] = {uid: None for uid in user_ids}
        for r in rows:
            out[r["user_id"]] = r["last_login"]
        return out

    @staticmethod
    def _row_to_entity(row: sqlite3.Row) -> BetaInvitation:
        return BetaInvitation(
            id=row["id"],
            email=row["email"],
            user_id=row["user_id"],
            invited_at=datetime.fromisoformat(row["invited_at"]),
            email_sent_at=datetime.fromisoformat(row["email_sent_at"])
            if row["email_sent_at"]
            else None,
            invited_by_user_id=row["invited_by_user_id"],
        )
