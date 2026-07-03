"""Port for issuing + verifying access JWTs (Auth Sprint A).

Wraps the algorithm-specific bits (HS256, RS256+JWKS) behind a Protocol
so use-cases depend on the contract rather than the concrete signer.
Today there's one adapter (``JwtSignerAdapter`` over HS256); the Clerk
path keeps its own ``AuthValidator`` because Clerk owns issuance, but
custom-mode issuance + verification now flows through this port."""
from __future__ import annotations

from typing import Optional, Protocol, TypedDict, runtime_checkable


class JwtClaims(TypedDict):
    """Minimal claim shape returned by ``JwtSigner.verify``.

    Kept small on purpose — profile-data (name, avatar) is reloaded from
    ``users`` on every refresh so JWTs never carry stale fields."""

    sub: str
    email: str
    is_admin: bool
    iat: int
    exp: int


@runtime_checkable
class JwtSigner(Protocol):
    """Port for issuing + verifying short-lived access tokens.

    ``sign`` MUST be deterministic only on (user_id, email, is_admin,
    current_time). ``verify`` MUST return ``None`` on any failure
    (expired, bad signature, malformed) so the calling adapter can
    collapse all failure modes into a single 401."""

    def sign(self, user_id: str, email: str, is_admin: bool) -> str: ...

    def verify(self, token: str) -> Optional[JwtClaims]: ...

    @property
    def ttl_seconds(self) -> int: ...
