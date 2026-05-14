"""OAuth credential domain entity (Meeting Frame foundation).

Stores per-user OAuth tokens for meeting providers (Google Meet, Microsoft
Teams, Zoom). Tokens live in memory as plaintext; the repository encrypts
them at rest via Fernet."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


OAuthProviderId = Literal["google", "microsoft", "zoom"]


@dataclass(frozen=True)
class OAuthCredential:
    id: str
    user_id: str
    provider: OAuthProviderId
    access_token: str
    refresh_token: str
    expires_at: int
    created_at: int
    updated_at: int
