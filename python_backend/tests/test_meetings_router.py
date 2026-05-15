"""Integration tests for ``/api/meetings/meet/create`` (Sprint 1).

Uses FastAPI ``TestClient`` against a minimal app mounting only the
meetings router. ``get_current_user`` and ``get_meet_provider`` are
dep-overridden so we don't need real auth / Google credentials."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.application.services.meet_provider import (
    NotConnectedError,
    TokenRefreshError,
)
from app.domain.entities.meeting import Meeting
from app.domain.entities.user import User
from app.infrastructure.meet.google_meet_client import MeetApiError
from app.presentation.api.meetings_router import router as meetings_router_module
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import get_meet_provider


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


def _make_user(user_id: str = "user-test-1") -> User:
    now = datetime.now(timezone.utc)
    return User(
        id=user_id,
        email="test@example.com",
        name="Test User",
        avatar_url=None,
        tier="free",
        language_preferred="en",
        created_at=now,
        updated_at=now,
    )


class _FakeMeetProvider:
    """Stand-in for ``MeetProvider`` — programmable result / exception."""

    def __init__(self) -> None:
        self.calls: list[dict[str, Any]] = []
        self.next_result: Meeting | None = None
        self.next_exception: BaseException | None = None

    async def create_meeting(
        self, user_id: str, title: str | None = None
    ) -> Meeting:
        self.calls.append({"user_id": user_id, "title": title})
        if self.next_exception is not None:
            raise self.next_exception
        if self.next_result is None:
            # Sensible default for happy-path tests.
            return Meeting(
                id="meet-1",
                user_id=user_id,
                provider="meet",
                join_url="https://meet.google.com/abc-defg-hij",
                provider_meeting_id="spaces/abc123",
                title=title,
                created_at=1_700_000_000_000,
            )
        return self.next_result


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture()
def fake_provider() -> _FakeMeetProvider:
    return _FakeMeetProvider()


@pytest.fixture()
def app(fake_provider: _FakeMeetProvider) -> FastAPI:
    fastapi_app = FastAPI()
    fastapi_app.include_router(meetings_router_module)

    fastapi_app.dependency_overrides[get_current_user] = lambda: _make_user()
    fastapi_app.dependency_overrides[get_meet_provider] = lambda: fake_provider
    return fastapi_app


@pytest.fixture()
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# Tests
# ---------------------------------------------------------------------------


def test_create_meet_returns_meeting(
    client: TestClient, fake_provider: _FakeMeetProvider
) -> None:
    resp = client.post(
        "/api/meetings/meet/create", json={"title": "Test meeting"}
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["id"] == "meet-1"
    assert body["provider"] == "meet"
    assert body["join_url"] == "https://meet.google.com/abc-defg-hij"
    assert body["title"] == "Test meeting"
    assert body["created_at"] == 1_700_000_000_000

    # Provider received the user id from the auth dep.
    assert fake_provider.calls == [
        {"user_id": "user-test-1", "title": "Test meeting"}
    ]


def test_create_meet_accepts_missing_title(
    client: TestClient, fake_provider: _FakeMeetProvider
) -> None:
    resp = client.post("/api/meetings/meet/create", json={})
    assert resp.status_code == 200, resp.text
    assert resp.json()["title"] is None
    assert fake_provider.calls[0]["title"] is None


def test_create_meet_when_not_connected_returns_412(
    client: TestClient, fake_provider: _FakeMeetProvider
) -> None:
    fake_provider.next_exception = NotConnectedError("not connected")
    resp = client.post("/api/meetings/meet/create", json={"title": "x"})
    assert resp.status_code == 412
    assert resp.json()["detail"] == "google_not_connected"


def test_create_meet_when_refresh_fails_returns_401(
    client: TestClient, fake_provider: _FakeMeetProvider
) -> None:
    fake_provider.next_exception = TokenRefreshError("refresh failed")
    resp = client.post("/api/meetings/meet/create", json={"title": "x"})
    assert resp.status_code == 401
    assert resp.json()["detail"] == "token_refresh_failed"


def test_create_meet_when_meet_api_fails_returns_502(
    client: TestClient, fake_provider: _FakeMeetProvider
) -> None:
    fake_provider.next_exception = MeetApiError(500, "upstream down")
    resp = client.post("/api/meetings/meet/create", json={"title": "x"})
    assert resp.status_code == 502
    detail = resp.json()["detail"]
    assert "meet_api_error" in detail
    assert "500" in detail
