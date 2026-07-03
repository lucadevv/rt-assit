"""RefreshToken domain entity (Auth Fase A).

Opaque random string (hex32) used to mint short-lived access JWTs via
``POST /api/auth/refresh``. The ``id`` field is BOTH the cookie value
AND the row primary key in ``refresh_tokens`` — i.e. the bearer
secret IS the lookup key. Validation is therefore DB-only: there is
no signature to verify, just an existence + active-state check.

Rotation: every successful refresh issues a NEW token row and revokes
the old one (``revoke_old, create_new`` in one transaction-ish flow).
This bounds the blast radius if a refresh cookie leaks — the attacker
can use it once, then it's invalidated and the legitimate user sees
their next refresh fail (forced re-login)."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class RefreshToken:
    """A persisted refresh-token row.

    ``revoked_at`` is the soft-delete marker; once non-null the token is
    inactive even if ``expires_at`` is still in the future. ``user_agent``
    and ``ip`` are stored for audit + future "active sessions" UI; they
    are advisory only (never used for auth decisions)."""

    id: str
    user_id: str
    expires_at: datetime
    revoked_at: Optional[datetime]
    user_agent: Optional[str]
    ip: Optional[str]
    created_at: datetime

    @property
    def is_active(self) -> bool:
        """True iff the token is neither revoked nor expired.

        Uses ``utcnow()`` (the same clock as ``compute_refresh_expiry``)
        so dev and prod stay consistent regardless of process TZ."""
        if self.revoked_at is not None:
            return False
        return datetime.utcnow() < self.expires_at
