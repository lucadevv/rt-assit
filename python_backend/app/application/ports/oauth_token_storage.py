"""OAuth token storage port (Meeting Frame foundation).

Provider-agnostic persistence interface for per-user OAuth credentials.
Provider-specific OAuth clients (Google, Microsoft, Zoom) consume this
port in Sprints 1-3."""
from __future__ import annotations

from typing import Optional, Protocol, runtime_checkable

from app.domain.entities.oauth_credential import (
    OAuthCredential,
    OAuthProviderId,
)


@runtime_checkable
class OAuthTokenStorage(Protocol):
    def save(self, credential: OAuthCredential) -> None:
        """Upsert by ``(user_id, provider)`` — encrypts tokens at rest."""
        ...

    def get(
        self, user_id: str, provider: OAuthProviderId
    ) -> Optional[OAuthCredential]: ...

    def delete(self, user_id: str, provider: OAuthProviderId) -> None: ...

    def list_for_user(self, user_id: str) -> list[OAuthCredential]: ...
