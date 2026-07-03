"""Port for minting opaque refresh-token secrets (Auth Sprint A).

The minter is intentionally tiny — it owns ONLY two concerns: producing
a fresh secret (the cookie value + PK of the row) and computing the
absolute expiry. Persistence + revocation logic stay in the repository
so the minter has no DB dependency."""
from __future__ import annotations

from datetime import datetime
from typing import Protocol, runtime_checkable


@runtime_checkable
class RefreshTokenMinter(Protocol):
    """Port for opaque-refresh-token issuance.

    ``mint`` MUST return a cryptographically-random string with at least
    128 bits of entropy. The string is used as BOTH the cookie value
    AND the primary key in ``refresh_tokens`` — there is no separate
    hash column because the row's existence + ``is_active`` is the only
    validation signal (cookie HttpOnly + DB-only validation = zero
    offline brute-force surface)."""

    def mint(self) -> str: ...

    def compute_expiry(self) -> datetime: ...

    @property
    def ttl_seconds(self) -> int: ...
