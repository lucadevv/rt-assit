"""MeetProvider — orchestrates Google Meet API calls with OAuth token mgmt.

Responsibilities (Sprint 1):
  - Load the user's stored OAuth credential.
  - Refresh the access_token if expired (using ``GoogleOAuthClient``).
  - Call ``GoogleMeetClient`` to create the Meet space.
  - Persist the resulting ``Meeting`` via ``MeetingsRepository``.

Stateless — constructed per request via DI. Sprints 2/3 will add Teams /
Zoom equivalents (separate service classes; no abstract Python-side port
is needed until then)."""
from __future__ import annotations

import logging
import time
import uuid
from dataclasses import replace

from app.application.ports.meetings_repository import MeetingsRepository
from app.application.ports.oauth_token_storage import OAuthTokenStorage
from app.domain.entities.meeting import Meeting
from app.domain.entities.oauth_credential import OAuthCredential
from app.infrastructure.meet.google_meet_client import (
    GoogleMeetClient,
    MeetApiError,
)
from app.infrastructure.oauth.google_oauth_client import GoogleOAuthClient


logger = logging.getLogger(__name__)


class NotConnectedError(Exception):
    """Raised when the user has not connected their Google account."""


class TokenRefreshError(Exception):
    """Raised when token refresh fails (e.g., refresh_token revoked)."""


# Refresh if the credential expires within this buffer. Paranoid 60s window
# so we don't race against clock skew between our box and Google's.
_REFRESH_BUFFER_MS = 60_000


class MeetProvider:
    def __init__(
        self,
        oauth_repo: OAuthTokenStorage,
        meetings_repo: MeetingsRepository,
        google_oauth_client: GoogleOAuthClient,
        google_meet_client: GoogleMeetClient,
    ) -> None:
        self._oauth_repo = oauth_repo
        self._meetings_repo = meetings_repo
        self._oauth = google_oauth_client
        self._meet = google_meet_client

    async def create_meeting(
        self,
        user_id: str,
        title: str | None = None,
    ) -> Meeting:
        cred = self._oauth_repo.get(user_id, "google")
        if cred is None:
            raise NotConnectedError(
                "Google not connected. User must complete OAuth flow first."
            )

        access_token = await self._ensure_fresh_token(cred)

        try:
            space = await self._meet.create_space(access_token)
        except MeetApiError as e:
            logger.error("[meet] create_space failed: %s", e)
            raise

        meeting = Meeting(
            id=str(uuid.uuid4()),
            user_id=user_id,
            provider="meet",
            join_url=space["meeting_uri"],
            provider_meeting_id=space["name"],
            title=title,
            created_at=int(time.time() * 1000),
        )
        self._meetings_repo.save(meeting)
        logger.info(
            "[meet] created meeting user_id=%s code=%s",
            user_id,
            space["meeting_code"],
        )
        return meeting

    async def _ensure_fresh_token(self, cred: OAuthCredential) -> str:
        """Return a valid access_token, refreshing if it's about to expire.

        On refresh, the new tokens are persisted via the repository so future
        calls don't have to refresh again."""
        now_ms = int(time.time() * 1000)
        if cred.expires_at - now_ms > _REFRESH_BUFFER_MS:
            return cred.access_token

        logger.info("[meet] refreshing access_token for user_id=%s", cred.user_id)
        try:
            tokens = await self._oauth.refresh_access_token(cred.refresh_token)
        except Exception as e:  # noqa: BLE001 — surface as our typed error
            logger.error("[meet] token refresh failed: %s", e)
            raise TokenRefreshError(str(e)) from e

        new_access: str = tokens["access_token"]
        # Google rarely returns a fresh refresh_token on refresh — fall back.
        new_refresh: str = tokens.get("refresh_token") or cred.refresh_token
        new_expiry: int = now_ms + int(tokens["expires_in"]) * 1000

        updated = replace(
            cred,
            access_token=new_access,
            refresh_token=new_refresh,
            expires_at=new_expiry,
            updated_at=now_ms,
        )
        self._oauth_repo.save(updated)
        return new_access
