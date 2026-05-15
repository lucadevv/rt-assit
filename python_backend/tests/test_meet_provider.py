"""Unit tests for ``MeetProvider`` (Sprint 1).

Uses in-memory fakes for the OAuth repo, meetings repo, Google OAuth client,
and Google Meet client so the suite runs offline."""
from __future__ import annotations

import time
import uuid
from typing import Any, Optional

import pytest

from app.application.services.meet_provider import (
    MeetProvider,
    NotConnectedError,
    TokenRefreshError,
)
from app.domain.entities.meeting import Meeting
from app.domain.entities.oauth_credential import (
    OAuthCredential,
    OAuthProviderId,
)
from app.infrastructure.meet.google_meet_client import MeetApiError


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class _InMemoryOAuthRepo:
    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], OAuthCredential] = {}
        self.save_count = 0

    def save(self, credential: OAuthCredential) -> None:
        self.rows[(credential.user_id, credential.provider)] = credential
        self.save_count += 1

    def get(
        self, user_id: str, provider: OAuthProviderId
    ) -> Optional[OAuthCredential]:
        return self.rows.get((user_id, provider))

    def delete(self, user_id: str, provider: OAuthProviderId) -> None:
        self.rows.pop((user_id, provider), None)

    def list_for_user(self, user_id: str) -> list[OAuthCredential]:
        return [c for (uid, _), c in self.rows.items() if uid == user_id]


class _InMemoryMeetingsRepo:
    def __init__(self) -> None:
        self.rows: dict[str, Meeting] = {}
        self.save_count = 0

    def save(self, meeting: Meeting) -> None:
        self.rows[meeting.id] = meeting
        self.save_count += 1

    def get(self, meeting_id: str) -> Meeting | None:
        return self.rows.get(meeting_id)

    def list_for_user(self, user_id: str, limit: int = 50) -> list[Meeting]:
        return [m for m in self.rows.values() if m.user_id == user_id][:limit]

    def delete(self, meeting_id: str) -> None:
        self.rows.pop(meeting_id, None)


class _FakeGoogleOAuthClient:
    def __init__(self) -> None:
        self.refresh_calls: list[str] = []
        self.refresh_response: dict[str, Any] = {
            "access_token": "new-access",
            "expires_in": 3600,
        }
        self.refresh_should_raise: BaseException | None = None

    async def refresh_access_token(self, refresh_token: str) -> dict[str, Any]:
        self.refresh_calls.append(refresh_token)
        if self.refresh_should_raise:
            raise self.refresh_should_raise
        return self.refresh_response


class _FakeGoogleMeetClient:
    def __init__(self) -> None:
        self.create_calls: list[str] = []
        self.create_response: dict[str, str] = {
            "name": "spaces/abc123",
            "meeting_uri": "https://meet.google.com/abc-defg-hij",
            "meeting_code": "abc-defg-hij",
        }
        self.create_should_raise: BaseException | None = None

    async def create_space(self, access_token: str) -> dict[str, str]:
        self.create_calls.append(access_token)
        if self.create_should_raise:
            raise self.create_should_raise
        return self.create_response


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def oauth_repo() -> _InMemoryOAuthRepo:
    return _InMemoryOAuthRepo()


@pytest.fixture()
def meetings_repo() -> _InMemoryMeetingsRepo:
    return _InMemoryMeetingsRepo()


@pytest.fixture()
def google_oauth() -> _FakeGoogleOAuthClient:
    return _FakeGoogleOAuthClient()


@pytest.fixture()
def google_meet() -> _FakeGoogleMeetClient:
    return _FakeGoogleMeetClient()


@pytest.fixture()
def provider(
    oauth_repo: _InMemoryOAuthRepo,
    meetings_repo: _InMemoryMeetingsRepo,
    google_oauth: _FakeGoogleOAuthClient,
    google_meet: _FakeGoogleMeetClient,
) -> MeetProvider:
    return MeetProvider(
        oauth_repo=oauth_repo,
        meetings_repo=meetings_repo,
        google_oauth_client=google_oauth,  # type: ignore[arg-type]
        google_meet_client=google_meet,  # type: ignore[arg-type]
    )


def _seed_credential(
    repo: _InMemoryOAuthRepo,
    *,
    user_id: str = "user-1",
    access_token: str = "fresh-access",
    refresh_token: str = "refresh-tok",
    expires_in_ms: int = 3_600_000,
) -> OAuthCredential:
    now_ms = int(time.time() * 1000)
    cred = OAuthCredential(
        id=str(uuid.uuid4()),
        user_id=user_id,
        provider="google",
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=now_ms + expires_in_ms,
        created_at=now_ms,
        updated_at=now_ms,
    )
    repo.save(cred)
    return cred


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_create_meeting_happy_path(
    provider: MeetProvider,
    oauth_repo: _InMemoryOAuthRepo,
    meetings_repo: _InMemoryMeetingsRepo,
    google_oauth: _FakeGoogleOAuthClient,
    google_meet: _FakeGoogleMeetClient,
) -> None:
    _seed_credential(oauth_repo, access_token="fresh-access")
    initial_saves = oauth_repo.save_count

    meeting = await provider.create_meeting(user_id="user-1", title="Test")

    assert meeting.user_id == "user-1"
    assert meeting.provider == "meet"
    assert meeting.join_url == "https://meet.google.com/abc-defg-hij"
    assert meeting.provider_meeting_id == "spaces/abc123"
    assert meeting.title == "Test"
    assert isinstance(meeting.created_at, int)

    # No refresh happened (token was fresh).
    assert google_oauth.refresh_calls == []
    # Meet API called with the existing access token.
    assert google_meet.create_calls == ["fresh-access"]
    # OAuth repo not touched again (no refresh persisted).
    assert oauth_repo.save_count == initial_saves
    # Meeting persisted.
    assert meetings_repo.save_count == 1
    assert meetings_repo.get(meeting.id) == meeting


@pytest.mark.asyncio
async def test_create_meeting_refreshes_expired_token(
    provider: MeetProvider,
    oauth_repo: _InMemoryOAuthRepo,
    google_oauth: _FakeGoogleOAuthClient,
    google_meet: _FakeGoogleMeetClient,
) -> None:
    # Token expires in 30s — within the 60s buffer → force refresh.
    _seed_credential(
        oauth_repo,
        access_token="stale-access",
        refresh_token="r1",
        expires_in_ms=30_000,
    )
    initial_saves = oauth_repo.save_count
    google_oauth.refresh_response = {
        "access_token": "fresh-access",
        "expires_in": 3600,
    }

    meeting = await provider.create_meeting(user_id="user-1")

    # Refresh was called with the stored refresh token.
    assert google_oauth.refresh_calls == ["r1"]
    # Meet API called with the NEW access token.
    assert google_meet.create_calls == ["fresh-access"]
    # Credential was re-saved (one extra save vs. baseline).
    assert oauth_repo.save_count == initial_saves + 1
    updated = oauth_repo.get("user-1", "google")
    assert updated is not None
    assert updated.access_token == "fresh-access"
    # refresh_token persists when Google omits it on refresh.
    assert updated.refresh_token == "r1"
    # New expiry is in the future.
    assert updated.expires_at > int(time.time() * 1000) + 3500_000

    assert meeting.provider_meeting_id == "spaces/abc123"


@pytest.mark.asyncio
async def test_create_meeting_no_credential_raises_not_connected(
    provider: MeetProvider,
) -> None:
    with pytest.raises(NotConnectedError):
        await provider.create_meeting(user_id="user-without-google")


@pytest.mark.asyncio
async def test_create_meeting_refresh_failure_raises(
    provider: MeetProvider,
    oauth_repo: _InMemoryOAuthRepo,
    google_oauth: _FakeGoogleOAuthClient,
) -> None:
    _seed_credential(oauth_repo, expires_in_ms=10_000)  # expired
    google_oauth.refresh_should_raise = RuntimeError("invalid_grant")

    with pytest.raises(TokenRefreshError):
        await provider.create_meeting(user_id="user-1")


@pytest.mark.asyncio
async def test_create_meeting_persists_meeting_record(
    provider: MeetProvider,
    oauth_repo: _InMemoryOAuthRepo,
    meetings_repo: _InMemoryMeetingsRepo,
) -> None:
    _seed_credential(oauth_repo)

    meeting = await provider.create_meeting(user_id="user-1", title="Onboarding")

    saved = meetings_repo.get(meeting.id)
    assert saved is not None
    assert saved.title == "Onboarding"
    assert saved.user_id == "user-1"
    assert saved.provider == "meet"
    assert saved.join_url == "https://meet.google.com/abc-defg-hij"
    assert saved.provider_meeting_id == "spaces/abc123"


@pytest.mark.asyncio
async def test_create_meeting_propagates_meet_api_error(
    provider: MeetProvider,
    oauth_repo: _InMemoryOAuthRepo,
    google_meet: _FakeGoogleMeetClient,
) -> None:
    _seed_credential(oauth_repo)
    google_meet.create_should_raise = MeetApiError(403, "forbidden")

    with pytest.raises(MeetApiError):
        await provider.create_meeting(user_id="user-1")
