"""LogoutUserUseCase (Auth Fase A).

Revokes the refresh token presented in the request cookie. The router
ALSO clears both auth cookies on the response, so the net effect is:
 - server: this refresh row is dead forever (cannot rotate)
 - client: browser no longer sends either cookie

Idempotent: calling logout twice (or with no refresh cookie at all) is
a 204 No Content, never an error. This lets the UI fire-and-forget the
logout call without worrying about "already logged out" races."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from app.application.ports.refresh_tokens_repository import (
    RefreshTokensRepository,
)


@dataclass
class LogoutUserUseCase:
    """Revoke a single refresh token (the one in the current cookie).

    Does NOT revoke other active refresh tokens for the same user — we
    intentionally support "logout this device only". A future "logout
    everywhere" endpoint can call ``refresh_tokens_repo.revoke_all_for_user``."""

    refresh_tokens_repo: RefreshTokensRepository

    def execute(self, refresh_token_id: Optional[str]) -> None:
        if refresh_token_id is None:
            return  # Idempotent — no cookie means already logged out.
        self.refresh_tokens_repo.revoke(refresh_token_id)
