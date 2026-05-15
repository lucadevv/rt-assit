"""GoogleMeetClient — thin wrapper around Google Meet REST API v2.

Stateless: each method takes an ``access_token`` and makes one HTTP call.
Token refresh is the caller's responsibility (``MeetProvider`` orchestrates
it via ``GoogleOAuthClient.refresh_access_token``)."""
from __future__ import annotations

import logging
from typing import TypedDict

import httpx

logger = logging.getLogger(__name__)


class MeetSpace(TypedDict):
    name: str  # "spaces/abc123"
    meeting_uri: str  # "https://meet.google.com/abc-defg-hij"
    meeting_code: str  # "abc-defg-hij"


class MeetApiError(Exception):
    """Raised when Google Meet REST API returns a non-2xx response."""

    def __init__(self, status: int, body: str) -> None:
        self.status = status
        self.body = body
        super().__init__(f"Meet API {status}: {body}")


class GoogleMeetClient:
    """Stateless client for Google Meet REST API v2.

    Each method takes an ``access_token`` and makes one HTTP call. Token
    refresh is handled by the caller (``MeetProvider``)."""

    BASE_URL = "https://meet.googleapis.com/v2"

    def __init__(self, http_client: httpx.AsyncClient | None = None) -> None:
        # Allow injection for tests; default to a fresh client per call so
        # we don't keep sockets open between requests in dev.
        self._injected_client = http_client

    async def _get_client(self) -> httpx.AsyncClient:
        if self._injected_client is not None:
            return self._injected_client
        return httpx.AsyncClient(timeout=10.0)

    async def create_space(self, access_token: str) -> MeetSpace:
        """POST /v2/spaces — creates a new Meet space owned by the token holder.

        Returns a typed dict with ``name``, ``meeting_uri``, ``meeting_code``.
        Raises ``MeetApiError`` on any non-2xx response."""
        url = f"{self.BASE_URL}/spaces"
        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        }
        # No config needed; Meet uses sensible defaults (open access, etc.).
        body: dict[str, object] = {}

        client = await self._get_client()
        owns_client = self._injected_client is None
        try:
            response = await client.post(url, headers=headers, json=body)
            if response.status_code >= 400:
                logger.error(
                    "[meet] create_space failed status=%s body=%s",
                    response.status_code,
                    response.text,
                )
                raise MeetApiError(response.status_code, response.text)
            data = response.json()
            return MeetSpace(
                name=data["name"],
                meeting_uri=data["meetingUri"],
                meeting_code=data["meetingCode"],
            )
        finally:
            if owns_client:
                await client.aclose()
