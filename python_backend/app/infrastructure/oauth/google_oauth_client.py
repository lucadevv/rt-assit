"""Google OAuth 2.0 client (Sprint 1 — Meet provider).

Implements the four operations the Meeting Frame OAuth flow needs:

* ``get_authorization_url`` — builds the consent-screen URL.
* ``exchange_code``         — swaps an auth code for tokens.
* ``refresh_access_token``  — uses the refresh token to mint a new access token.
* ``revoke``                — revokes a refresh/access token.
* ``fetch_userinfo``        — reads the OIDC userinfo endpoint.

Scopes requested cover identity (``openid``, email, profile) plus the
Google Meet Spaces API (``meetings.space.created`` /
``meetings.space.settings``) used by the upcoming ``MeetProvider`` adapter."""
from __future__ import annotations

import logging
from typing import Any
from urllib.parse import urlencode

import httpx

logger = logging.getLogger(__name__)


# --- Constants ---------------------------------------------------------------

_AUTHORIZATION_URL = "https://accounts.google.com/o/oauth2/v2/auth"
_TOKEN_URL = "https://oauth2.googleapis.com/token"
_REVOKE_URL = "https://oauth2.googleapis.com/revoke"
_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo"

GOOGLE_OAUTH_SCOPES: tuple[str, ...] = (
    "openid",
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/userinfo.profile",
    "https://www.googleapis.com/auth/meetings.space.created",
    "https://www.googleapis.com/auth/meetings.space.settings",
)

_DEFAULT_TIMEOUT_SECONDS = 10.0


# --- Errors ------------------------------------------------------------------


class OAuthExchangeError(Exception):
    """Raised when Google returns a non-2xx response to a token operation."""

    def __init__(
        self, message: str, *, status_code: int | None = None, body: str | None = None
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.body = body


# --- Client ------------------------------------------------------------------


class GoogleOAuthClient:
    """Thin async wrapper around Google's OAuth 2.0 endpoints.

    Stateless: a single instance can be shared across requests. The instance
    only holds the three identity values (``client_id``, ``client_secret``,
    ``redirect_uri``) — token storage is the caller's responsibility."""

    def __init__(
        self,
        client_id: str,
        client_secret: str,
        redirect_uri: str,
        *,
        scopes: tuple[str, ...] = GOOGLE_OAUTH_SCOPES,
        timeout_seconds: float = _DEFAULT_TIMEOUT_SECONDS,
    ) -> None:
        if not client_id:
            raise ValueError("client_id is required")
        if not client_secret:
            raise ValueError("client_secret is required")
        if not redirect_uri:
            raise ValueError("redirect_uri is required")

        self._client_id = client_id
        self._client_secret = client_secret
        self._redirect_uri = redirect_uri
        self._scopes = scopes
        self._timeout_seconds = timeout_seconds

    # ---------------------------------------------------------------------
    # Authorization (consent screen URL)
    # ---------------------------------------------------------------------

    def get_authorization_url(self, state: str) -> str:
        """Build the Google authorization URL.

        ``state`` is the CSRF token the caller MUST verify on callback."""
        if not state:
            raise ValueError("state is required (CSRF protection)")

        params = {
            "client_id": self._client_id,
            "redirect_uri": self._redirect_uri,
            "state": state,
            "response_type": "code",
            "access_type": "offline",
            "prompt": "consent",
            "scope": " ".join(self._scopes),
            "include_granted_scopes": "true",
        }
        return f"{_AUTHORIZATION_URL}?{urlencode(params)}"

    # ---------------------------------------------------------------------
    # Token exchange / refresh / revoke
    # ---------------------------------------------------------------------

    async def exchange_code(self, code: str) -> dict[str, Any]:
        """Swap an authorization code for tokens.

        Returns the raw Google response: ``access_token``, ``refresh_token``,
        ``expires_in``, ``scope``, ``token_type``, ``id_token``."""
        if not code:
            raise ValueError("code is required")

        payload = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "code": code,
            "redirect_uri": self._redirect_uri,
            "grant_type": "authorization_code",
        }
        return await self._post_token(payload, op="exchange_code")

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        """Use a refresh token to mint a new access token.

        Note: Google rarely returns a fresh ``refresh_token`` here, so callers
        should fall back to the previously stored one when it's absent."""
        if not refresh_token:
            raise ValueError("refresh_token is required")

        payload = {
            "client_id": self._client_id,
            "client_secret": self._client_secret,
            "refresh_token": refresh_token,
            "grant_type": "refresh_token",
        }
        return await self._post_token(payload, op="refresh_access_token")

    async def revoke(self, token: str) -> None:
        """Revoke a refresh or access token at Google.

        Idempotent from the caller's POV — both 200 and 400 (already revoked)
        are treated as success; anything else raises ``OAuthExchangeError``."""
        if not token:
            raise ValueError("token is required")

        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            response = await client.post(_REVOKE_URL, params={"token": token})

        if response.status_code == 200:
            return
        if response.status_code == 400:
            # Google returns 400 with `invalid_token` when already revoked.
            logger.info(
                "[google_oauth] revoke received 400 (treating as already-revoked): %s",
                response.text,
            )
            return

        logger.error(
            "[google_oauth] revoke failed status=%s body=%s",
            response.status_code,
            response.text,
        )
        raise OAuthExchangeError(
            "Failed to revoke Google token",
            status_code=response.status_code,
            body=response.text,
        )

    # ---------------------------------------------------------------------
    # Userinfo
    # ---------------------------------------------------------------------

    async def fetch_userinfo(self, access_token: str) -> dict[str, Any]:
        """Fetch the OIDC userinfo claims (``sub``, ``email``, ``name``, ``picture``)."""
        if not access_token:
            raise ValueError("access_token is required")

        headers = {"Authorization": f"Bearer {access_token}"}
        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            response = await client.get(_USERINFO_URL, headers=headers)

        if response.status_code != 200:
            logger.error(
                "[google_oauth] userinfo failed status=%s body=%s",
                response.status_code,
                response.text,
            )
            raise OAuthExchangeError(
                "Failed to fetch Google userinfo",
                status_code=response.status_code,
                body=response.text,
            )
        return response.json()

    # ---------------------------------------------------------------------
    # Internals
    # ---------------------------------------------------------------------

    async def _post_token(
        self, payload: dict[str, str], *, op: str
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=self._timeout_seconds) as client:
            response = await client.post(_TOKEN_URL, data=payload)

        if response.status_code != 200:
            logger.error(
                "[google_oauth] %s failed status=%s body=%s",
                op,
                response.status_code,
                response.text,
            )
            raise OAuthExchangeError(
                f"Google {op} failed",
                status_code=response.status_code,
                body=response.text,
            )

        try:
            data: dict[str, Any] = response.json()
        except ValueError as exc:
            raise OAuthExchangeError(
                f"Google {op} returned non-JSON body",
                status_code=response.status_code,
                body=response.text,
            ) from exc
        return data
