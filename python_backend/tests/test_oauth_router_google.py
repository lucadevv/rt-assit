"""Integration tests for ``/api/oauth/google/*`` (Sprint 1).

Uses FastAPI ``TestClient`` against a minimal app mounting only the OAuth
router. ``get_current_user``, ``get_oauth_repository`` and
``get_google_oauth_client`` are all dep-overridden so we don't need real
Clerk auth, a real SQLite DB, or real Google credentials."""
from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.domain.entities.oauth_credential import OAuthCredential, OAuthProviderId
from app.domain.entities.user import User
from app.presentation.api.oauth_router import (
    _oauth_state_store,
    router as oauth_router_module,
)
from app.presentation.auth.middleware import get_current_user


# ---------------------------------------------------------------------------
# Fakes
# ---------------------------------------------------------------------------


class _InMemoryOAuthRepo:
    """OAuthTokenStorage implementation backed by a dict — no encryption."""

    def __init__(self) -> None:
        self.rows: dict[tuple[str, str], OAuthCredential] = {}

    def save(self, credential: OAuthCredential) -> None:
        self.rows[(credential.user_id, credential.provider)] = credential

    def get(
        self, user_id: str, provider: OAuthProviderId
    ) -> Optional[OAuthCredential]:
        return self.rows.get((user_id, provider))

    def delete(self, user_id: str, provider: OAuthProviderId) -> None:
        self.rows.pop((user_id, provider), None)

    def list_for_user(self, user_id: str) -> list[OAuthCredential]:
        return [c for (uid, _), c in self.rows.items() if uid == user_id]


class _FakeGoogleClient:
    """Stubbed Google client — records calls, returns canned tokens."""

    def __init__(self) -> None:
        self.exchange_calls: list[str] = []
        self.revoke_calls: list[str] = []
        self.exchange_response: dict[str, Any] = {
            "access_token": "fake-access",
            "refresh_token": "fake-refresh",
            "expires_in": 3600,
            "scope": "openid",
            "token_type": "Bearer",
            "id_token": "fake-id",
        }
        self.exchange_should_raise: BaseException | None = None
        self.revoke_should_raise: BaseException | None = None

    def get_authorization_url(self, state: str) -> str:
        scopes = " ".join(
            [
                "openid",
                "https://www.googleapis.com/auth/userinfo.email",
                "https://www.googleapis.com/auth/userinfo.profile",
                "https://www.googleapis.com/auth/meetings.space.created",
                "https://www.googleapis.com/auth/meetings.space.settings",
            ]
        )
        return (
            "https://accounts.google.com/o/oauth2/v2/auth"
            f"?client_id=fake-cid&state={state}&scope={scopes.replace(' ', '+')}"
            "&redirect_uri=http%3A%2F%2Flocalhost%3A8000%2Fapi%2Foauth%2Fgoogle%2Fcallback"
            "&response_type=code&access_type=offline&prompt=consent"
        )

    async def exchange_code(self, code: str) -> dict[str, Any]:
        self.exchange_calls.append(code)
        if self.exchange_should_raise:
            raise self.exchange_should_raise
        return self.exchange_response

    async def revoke(self, token: str) -> None:
        self.revoke_calls.append(token)
        if self.revoke_should_raise:
            raise self.revoke_should_raise


# ---------------------------------------------------------------------------
# Fixtures
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


@pytest.fixture()
def fake_repo() -> _InMemoryOAuthRepo:
    return _InMemoryOAuthRepo()


@pytest.fixture()
def fake_google() -> _FakeGoogleClient:
    return _FakeGoogleClient()


@pytest.fixture()
def app(
    fake_repo: _InMemoryOAuthRepo, fake_google: _FakeGoogleClient
) -> FastAPI:
    """Build a minimal FastAPI app with the OAuth router and overridden deps."""
    # Lazy imports so each test gets a clean dependency wiring.
    from app.presentation.deps import (
        get_google_oauth_client,
        get_oauth_repository,
    )

    fastapi_app = FastAPI()
    fastapi_app.include_router(oauth_router_module)

    fastapi_app.dependency_overrides[get_oauth_repository] = lambda: fake_repo
    fastapi_app.dependency_overrides[get_google_oauth_client] = lambda: fake_google
    fastapi_app.dependency_overrides[get_current_user] = lambda: _make_user()

    # Reset the module-level CSRF state store between tests.
    _oauth_state_store.clear()
    return fastapi_app


@pytest.fixture()
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# /api/oauth/google/authorize
# ---------------------------------------------------------------------------


def test_authorize_returns_url_with_scopes_and_state(
    client: TestClient,
) -> None:
    resp = client.get("/api/oauth/google/authorize")
    assert resp.status_code == 200, resp.text

    body = resp.json()
    url = body["authorization_url"]
    state = body["state"]
    assert state, "state must be returned to the caller"

    assert "accounts.google.com" in url
    assert "meetings.space.created" in url
    assert f"state={state}" in url

    # state stored server-side for callback validation.
    assert state in _oauth_state_store


def test_authorize_for_unsupported_provider_returns_501(
    client: TestClient,
) -> None:
    resp = client.get("/api/oauth/microsoft/authorize")
    assert resp.status_code == 501


def test_authorize_for_unknown_provider_returns_400(
    client: TestClient,
) -> None:
    resp = client.get("/api/oauth/yahoo/authorize")
    assert resp.status_code == 400


# ---------------------------------------------------------------------------
# /api/oauth/google/callback
# ---------------------------------------------------------------------------


def test_callback_with_invalid_state_returns_400(client: TestClient) -> None:
    resp = client.get(
        "/api/oauth/google/callback",
        params={"code": "abc", "state": "definitely-not-stored"},
    )
    assert resp.status_code == 400
    detail = resp.json()["detail"]
    assert detail["detail"] == "invalid_state"


def test_callback_with_error_param_returns_400(client: TestClient) -> None:
    # Seed a valid state so we know the failure is the error param, not state.
    _oauth_state_store["S"] = ("user-test-1", time.time())
    resp = client.get(
        "/api/oauth/google/callback",
        params={"state": "S", "error": "access_denied"},
    )
    assert resp.status_code == 400
    assert resp.json()["detail"]["detail"] == "oauth_error"


def test_callback_happy_path_persists_credential(
    client: TestClient,
    fake_repo: _InMemoryOAuthRepo,
    fake_google: _FakeGoogleClient,
) -> None:
    # Issue a state first via /authorize, then call /callback with it.
    auth_resp = client.get("/api/oauth/google/authorize")
    state = auth_resp.json()["state"]

    resp = client.get(
        "/api/oauth/google/callback",
        params={"code": "the-code", "state": state},
    )
    assert resp.status_code == 200, resp.text
    body = resp.json()
    assert body["connected"] is True
    assert body["provider"] == "google"
    assert body["user_id"] == "user-test-1"

    # State was consumed.
    assert state not in _oauth_state_store

    # Exchange was called.
    assert fake_google.exchange_calls == ["the-code"]

    # Credential persisted.
    saved = fake_repo.get("user-test-1", "google")
    assert saved is not None
    assert saved.access_token == "fake-access"
    assert saved.refresh_token == "fake-refresh"
    # expires_at should be ~now + 3600s (in ms).
    now_ms = int(time.time() * 1000)
    assert now_ms + 3500 * 1000 <= saved.expires_at <= now_ms + 3700 * 1000


def test_callback_for_unsupported_provider_returns_501(
    client: TestClient,
) -> None:
    resp = client.get(
        "/api/oauth/microsoft/callback",
        params={"code": "x", "state": "y"},
    )
    assert resp.status_code == 501


# ---------------------------------------------------------------------------
# /api/oauth/google/revoke
# ---------------------------------------------------------------------------


def test_revoke_happy_path_deletes_credential(
    client: TestClient,
    fake_repo: _InMemoryOAuthRepo,
    fake_google: _FakeGoogleClient,
) -> None:
    now_ms = int(time.time() * 1000)
    fake_repo.save(
        OAuthCredential(
            id=str(uuid.uuid4()),
            user_id="user-test-1",
            provider="google",
            access_token="a",
            refresh_token="r",
            expires_at=now_ms + 3600_000,
            created_at=now_ms,
            updated_at=now_ms,
        )
    )

    resp = client.post("/api/oauth/google/revoke")
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"revoked": True, "provider": "google"}

    # Provider was called with the refresh token.
    assert fake_google.revoke_calls == ["r"]
    # Credential was deleted.
    assert fake_repo.get("user-test-1", "google") is None


def test_revoke_without_credential_returns_404(client: TestClient) -> None:
    resp = client.post("/api/oauth/google/revoke")
    assert resp.status_code == 404


def test_revoke_for_unsupported_provider_returns_501(client: TestClient) -> None:
    resp = client.post("/api/oauth/microsoft/revoke")
    assert resp.status_code == 501
