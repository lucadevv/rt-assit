"""Integration tests for ``POST /api/auth/login`` (Sprint B1).

Covers:
* Happy path — body shape, cookie shape, DB side-effect
* Wrong credentials — uniform 401 ``invalid_credentials``
* Unknown email — same uniform 401 (no enumeration channel)
* Legacy user without password — refused
* Bad input (invalid email format) — 422 from Pydantic"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.entities.user import User
from app.infrastructure.persistence.sqlite.refresh_tokens_repository import (
    SQLiteRefreshTokensRepository,
)
from tests.auth.conftest import TEST_USER_PASSWORD


# ---------------------------------------------------------------------------
# Success
# ---------------------------------------------------------------------------


class TestLoginSuccess:
    def test_login_returns_200_with_cookies(
        self, client: TestClient, test_user: User
    ) -> None:
        resp = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": TEST_USER_PASSWORD},
        )
        assert resp.status_code == 200, resp.text

        # Both auth cookies present on the response. ``Set-Cookie`` may
        # appear more than once so we inspect raw headers.
        set_cookie_header = resp.headers.get("set-cookie", "")
        assert "susurra_access=" in set_cookie_header
        assert "susurra_refresh=" in set_cookie_header

    def test_login_response_body_has_correct_user_shape(
        self, client: TestClient, test_user: User
    ) -> None:
        resp = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": TEST_USER_PASSWORD},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["user"]["id"] == test_user.id
        assert body["user"]["email"] == test_user.email
        assert body["user"]["is_admin"] is False
        # Backward-compat: body still carries the access JWT (Fase D will
        # drop this once the frontend stops reading it from JSON).
        assert isinstance(body["access_token"], str)
        # JWT shape: header.payload.signature
        assert body["access_token"].count(".") == 2
        assert body["token_type"] == "bearer"
        assert body["expires_in"] == 15 * 60

    def test_login_creates_refresh_token_in_db(
        self,
        client: TestClient,
        test_user: User,
        refresh_tokens_repo: SQLiteRefreshTokensRepository,
    ) -> None:
        resp = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": TEST_USER_PASSWORD},
        )
        assert resp.status_code == 200, resp.text

        # Pluck the refresh cookie value out of the jar and verify the
        # row was persisted with revoked_at = NULL.
        refresh_cookie = client.cookies.get("susurra_refresh")
        assert refresh_cookie is not None
        row = refresh_tokens_repo.get_by_id(refresh_cookie)
        assert row is not None
        assert row.user_id == test_user.id
        assert row.revoked_at is None
        assert row.is_active is True


# ---------------------------------------------------------------------------
# Failure
# ---------------------------------------------------------------------------


class TestLoginFailure:
    def test_login_with_invalid_email_format_returns_422(
        self, client: TestClient
    ) -> None:
        # Pydantic's EmailStr rejects malformed inputs at the request
        # boundary — the use case never runs.
        resp = client.post(
            "/api/auth/login",
            json={"email": "not-an-email", "password": "whatever-pw-123"},
        )
        assert resp.status_code == 422

    def test_login_with_wrong_password_returns_401(
        self, client: TestClient, test_user: User
    ) -> None:
        resp = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": "wrong-password-12345"},
        )
        assert resp.status_code == 401
        # Single uniform error message — no leak of which leg failed.
        assert resp.json()["detail"] == "invalid_credentials"

    def test_login_with_unknown_email_returns_401(
        self, client: TestClient
    ) -> None:
        resp = client.post(
            "/api/auth/login",
            json={
                "email": "nobody@example.com",
                "password": "any-password-12345",
            },
        )
        assert resp.status_code == 401
        # SAME error string as wrong-password — protects against email
        # enumeration via response-body diff.
        assert resp.json()["detail"] == "invalid_credentials"

    def test_login_with_user_without_password_hash_returns_401(
        self,
        client: TestClient,
        user_without_password: User,
    ) -> None:
        # Legacy / dev-default user — no password_hash column means the
        # use case rejects with the same uniform 401 instead of
        # crashing or accidentally allowing the login.
        resp = client.post(
            "/api/auth/login",
            json={
                "email": user_without_password.email,
                "password": "any-password-12345",
            },
        )
        assert resp.status_code == 401
        assert resp.json()["detail"] == "invalid_credentials"
