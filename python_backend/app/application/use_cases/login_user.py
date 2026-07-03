"""LoginUser — email + password → (User, access JWT, refresh token).

Used by the ``POST /api/auth/login`` endpoint (AUTH_MODE=custom).
Raises ``UnauthorizedError`` for any credential failure — same exception
for unknown email and bad password so the API can return a uniform
401 ``invalid_credentials`` (no timing or message-leak side channel).

Auth Sprint A: dependencies are now PORTS not concrete infra — the use
case takes a ``JwtSigner``, a ``PasswordHasher``, and a
``RefreshTokenMinter``. Concrete adapters are wired in
``presentation/deps.py``.

Atomicity note: ``LoginUserUseCase`` mints an access JWT in-memory
(cannot fail) and persists ONE refresh-token row. The persistence is a
single INSERT — there's no multi-statement window to protect today.
The ``rotate()`` transaction pattern is established in
``RefreshAccessTokenUseCase`` so future flows that need to atomically
write the refresh row + an audit log / ``last_login_at`` / etc. can
extend the repository with a ``create_with_side_effects(...)`` method
or move the insert into the same ``begin_transaction=True`` block."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.application.ports.jwt_signer import JwtSigner
from app.application.ports.password_hasher import PasswordHasher
from app.application.ports.refresh_token_minter import RefreshTokenMinter
from app.application.ports.refresh_tokens_repository import (
    RefreshTokensRepository,
)
from app.application.ports.users_repository import UsersRepository
from app.domain.entities.refresh_token import RefreshToken
from app.domain.entities.user import User
from app.domain.exceptions import UnauthorizedError


@dataclass
class LoginResult:
    """Login output carried back to the router.

    ``access_token`` / ``access_expires_in`` cover the short-lived JWT.
    ``refresh_token`` / ``refresh_expires_in`` cover the opaque refresh
    secret that the router writes into the HttpOnly refresh cookie."""

    user: User
    access_token: str
    access_expires_in: int      # seconds (matches JwtSigner.ttl_seconds)
    refresh_token: str          # opaque hex32
    refresh_expires_in: int     # seconds (matches RefreshTokenMinter.ttl_seconds)


class LoginUserUseCase:
    """Verify credentials and mint an access JWT + persisted refresh token.

    The ``users_repo.get_by_email_with_password`` call is the only path
    that exposes ``password_hash`` — auditable by grep so we never
    accidentally read the hash in unrelated flows."""

    def __init__(
        self,
        users_repo: UsersRepository,
        refresh_tokens_repo: RefreshTokensRepository,
        jwt_signer: JwtSigner,
        password_hasher: PasswordHasher,
        refresh_minter: RefreshTokenMinter,
    ) -> None:
        self.users_repo = users_repo
        self.refresh_tokens_repo = refresh_tokens_repo
        self.jwt_signer = jwt_signer
        self.password_hasher = password_hasher
        self.refresh_minter = refresh_minter

    def execute(
        self,
        *,
        email: str,
        password: str,
        user_agent: Optional[str] = None,
        ip: Optional[str] = None,
    ) -> LoginResult:
        user = self.users_repo.get_by_email_with_password(email)
        if user is None or not user.password_hash:
            raise UnauthorizedError("invalid_credentials")
        if not self.password_hasher.verify(password, user.password_hash):
            raise UnauthorizedError("invalid_credentials")

        access_token = self.jwt_signer.sign(
            user_id=user.id, email=user.email, is_admin=user.is_admin
        )
        refresh = self._create_refresh(user.id, user_agent, ip)

        return LoginResult(
            user=user,
            access_token=access_token,
            access_expires_in=self.jwt_signer.ttl_seconds,
            refresh_token=refresh.id,
            refresh_expires_in=self.refresh_minter.ttl_seconds,
        )

    def _create_refresh(
        self,
        user_id: str,
        user_agent: Optional[str],
        ip: Optional[str],
    ) -> RefreshToken:
        token = RefreshToken(
            id=self.refresh_minter.mint(),
            user_id=user_id,
            expires_at=self.refresh_minter.compute_expiry(),
            revoked_at=None,
            user_agent=user_agent,
            ip=ip,
            created_at=datetime.utcnow(),
        )
        return self.refresh_tokens_repo.create(token)
