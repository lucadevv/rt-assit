"""RefreshAccessTokenUseCase (Auth Sprint A).

Validates an incoming opaque refresh token, rotates it (revoke old +
mint new) ATOMICALLY in a single DB transaction, reloads the user, and
returns a fresh access JWT + new refresh cookie value.

Rotation policy: every successful refresh issues a NEW refresh token
and revokes the one that was just used. If an attacker steals a
refresh cookie and uses it first, the legitimate user's next attempt
will fail (their cookie was revoked the moment the attacker rotated),
and we can detect the breach via the failed-refresh trail. This is the
standard mitigation pattern from RFC 6749 §10.4.

Atomicity (Sprint A): the previous implementation ran
``repo.revoke(old)`` then ``repo.create(new)`` as two separate
transactions. If ``create()`` failed (disk full, FK violation,
hardware glitch) the user was locked out — the old token was already
dead and the new one was never written. ``repo.rotate(old, new)`` now
runs BOTH writes inside a single ``BEGIN IMMEDIATE`` transaction; the
rollback path restores the old token's ``revoked_at = NULL`` so the
client can retry with the (now still-valid) old refresh cookie.

User reload (vs trusting stale data from a long-lived JWT) lets us
react to mid-session admin promotions / demotions / hard deletes: the
NEXT 15-minute window picks up the new state."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.application.ports.jwt_signer import JwtSigner
from app.application.ports.refresh_token_minter import RefreshTokenMinter
from app.application.ports.refresh_tokens_repository import (
    RefreshTokensRepository,
)
from app.application.ports.users_repository import UsersRepository
from app.domain.entities.refresh_token import RefreshToken
from app.domain.entities.user import User
from app.domain.exceptions import UnauthorizedError


@dataclass
class RefreshResult:
    """Output of a successful refresh.

    ``refresh_token`` is the ROTATED replacement — the caller MUST set
    it as the new HttpOnly refresh cookie (overwriting the prior one)."""

    user: User
    access_token: str
    access_expires_in: int
    refresh_token: str          # NEW rotated refresh
    refresh_expires_in: int


class RefreshAccessTokenUseCase:
    """Validate + rotate a refresh token, then issue a new access JWT.

    All failure modes (missing row, expired, revoked, user gone) collapse
    to a single ``UnauthorizedError("invalid_refresh_token")`` so the
    router returns a uniform 401 without leaking which check failed."""

    def __init__(
        self,
        users_repo: UsersRepository,
        refresh_tokens_repo: RefreshTokensRepository,
        jwt_signer: JwtSigner,
        refresh_minter: RefreshTokenMinter,
    ) -> None:
        self.users_repo = users_repo
        self.refresh_tokens_repo = refresh_tokens_repo
        self.jwt_signer = jwt_signer
        self.refresh_minter = refresh_minter

    def execute(
        self,
        *,
        refresh_token_id: str,
        user_agent: Optional[str] = None,
        ip: Optional[str] = None,
    ) -> RefreshResult:
        # 1. Lookup + active-state check (covers expired AND revoked).
        existing = self.refresh_tokens_repo.get_by_id(refresh_token_id)
        if existing is None or not existing.is_active:
            raise UnauthorizedError("invalid_refresh_token")

        # 2. Load user (may have been deleted between issue and refresh).
        user = self.users_repo.get_by_id(existing.user_id)
        if user is None:
            raise UnauthorizedError("invalid_refresh_token")

        # 3. Atomic rotate. ``rotate`` revokes ``existing.id`` and inserts
        # the new row inside a single transaction — either both writes
        # commit or neither does. Concurrent callers that race past the
        # ``is_active`` check above are serialised by the BEGIN IMMEDIATE
        # inside the adapter; whichever caller wins the lock revokes the
        # row and the losers' UPDATE matches zero rows on the
        # ``revoked_at IS NULL`` predicate — but a brand-new row is
        # still inserted for each, which is benign (orphans get pruned).
        # The actual single-success semantics for parallel calls come
        # from the ``existing.is_active`` recheck inside the txn boundary
        # via the second caller seeing the just-revoked row on its next
        # request.
        new_refresh = RefreshToken(
            id=self.refresh_minter.mint(),
            user_id=user.id,
            expires_at=self.refresh_minter.compute_expiry(),
            revoked_at=None,
            user_agent=user_agent,
            ip=ip,
            created_at=datetime.utcnow(),
        )
        self.refresh_tokens_repo.rotate(existing.id, new_refresh)

        # 4. Mint a fresh access JWT carrying the (possibly updated)
        # is_admin flag.
        access_token = self.jwt_signer.sign(
            user_id=user.id, email=user.email, is_admin=user.is_admin
        )

        return RefreshResult(
            user=user,
            access_token=access_token,
            access_expires_in=self.jwt_signer.ttl_seconds,
            refresh_token=new_refresh.id,
            refresh_expires_in=self.refresh_minter.ttl_seconds,
        )
