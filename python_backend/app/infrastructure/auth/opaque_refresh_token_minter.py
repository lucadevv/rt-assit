"""Opaque refresh-token minter (concrete adapter for ``RefreshTokenMinter``).

NOT a JWT — pure random bytes, persisted in DB and validated on every
refresh call. We deliberately avoid signing/encoding because the token
itself carries no claims; the DB row is the source of truth (user_id,
expiry, revoked-state). This keeps the rotation flow trivial: revoke
the old row + INSERT a fresh row in a single transaction (see
``SQLiteRefreshTokensRepository.rotate``).

Length rationale:
  ``secrets.token_hex(16)`` → 32 hex chars → 128 bits of entropy.
  Resistant to online guessing (rate-limit makes brute force infeasible)
  and to offline attacks (no signature to crack — leak of the DB row
  IS the leak of the token; there's no separate secret to discover)."""
from __future__ import annotations

import secrets
from datetime import datetime, timedelta

from app.application.ports.refresh_token_minter import RefreshTokenMinter


_REFRESH_TTL_DAYS = 30
_REFRESH_TTL_SECONDS = _REFRESH_TTL_DAYS * 24 * 60 * 60


class OpaqueRefreshTokenMinter(RefreshTokenMinter):
    """Concrete minter — 128-bit hex secrets + sliding 30d expiry."""

    @property
    def ttl_seconds(self) -> int:
        return _REFRESH_TTL_SECONDS

    def mint(self) -> str:
        # 32 hex chars (16 bytes of entropy). Used as BOTH the cookie
        # value AND the row id in ``refresh_tokens``.
        return secrets.token_hex(16)

    def compute_expiry(self) -> datetime:
        # Sliding extension is implemented at the use-case layer: every
        # successful refresh REVOKES the old row and INSERTs a brand-new
        # one with a fresh expiry, effectively extending the session for
        # another full TTL window.
        return datetime.utcnow() + timedelta(seconds=_REFRESH_TTL_SECONDS)
