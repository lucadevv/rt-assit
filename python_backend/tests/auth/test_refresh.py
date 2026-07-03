"""Integration tests for ``POST /api/auth/refresh`` (Sprint B1).

Covers:
* Happy path — new cookies + body, old token revoked, new token created
* Missing cookie — 401
* Expired / revoked / orphan token — uniform 401
* Atomic rotation — the SAME original cookie cannot be redeemed twice
  (the second redemption sees a revoked row and 401s)"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.entities.refresh_token import RefreshToken
from app.domain.entities.user import User
from app.infrastructure.persistence.sqlite.refresh_tokens_repository import (
    SQLiteRefreshTokensRepository,
)
from app.presentation.api.cookies import REFRESH_COOKIE
from tests.auth.conftest import TEST_USER_PASSWORD


# ---------------------------------------------------------------------------
# Success
# ---------------------------------------------------------------------------


class TestRefreshSuccess:
    def test_refresh_with_valid_token_returns_200(
        self,
        authed_client: TestClient,
        test_user: User,
    ) -> None:
        resp = authed_client.post("/api/auth/refresh")
        assert resp.status_code == 200, resp.text

        body = resp.json()
        assert body["user"]["id"] == test_user.id
        assert isinstance(body["access_token"], str)
        assert body["access_token"].count(".") == 2

        # Response carries new cookies (Set-Cookie for both).
        set_cookie = resp.headers.get("set-cookie", "")
        assert "susurra_access=" in set_cookie
        assert "susurra_refresh=" in set_cookie

    def test_refresh_revokes_old_token(
        self,
        client: TestClient,
        test_user: User,
        refresh_tokens_repo: SQLiteRefreshTokensRepository,
    ) -> None:
        # Log in to mint a refresh token, capture its id, then refresh
        # and verify the OLD row is now revoked.
        login = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": TEST_USER_PASSWORD},
        )
        assert login.status_code == 200
        old_refresh_id = client.cookies.get("susurra_refresh")
        assert old_refresh_id is not None

        refresh = client.post("/api/auth/refresh")
        assert refresh.status_code == 200, refresh.text

        old_row = refresh_tokens_repo.get_by_id(old_refresh_id)
        assert old_row is not None
        assert old_row.revoked_at is not None
        assert old_row.is_active is False

    def test_refresh_creates_new_token(
        self,
        client: TestClient,
        test_user: User,
        refresh_tokens_repo: SQLiteRefreshTokensRepository,
    ) -> None:
        login = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": TEST_USER_PASSWORD},
        )
        assert login.status_code == 200
        old_refresh_id = client.cookies.get("susurra_refresh")

        refresh = client.post("/api/auth/refresh")
        assert refresh.status_code == 200, refresh.text

        new_refresh_id = client.cookies.get("susurra_refresh")
        assert new_refresh_id is not None
        assert new_refresh_id != old_refresh_id

        new_row = refresh_tokens_repo.get_by_id(new_refresh_id)
        assert new_row is not None
        assert new_row.user_id == test_user.id
        assert new_row.revoked_at is None
        assert new_row.is_active is True


# ---------------------------------------------------------------------------
# Failure
# ---------------------------------------------------------------------------


class TestRefreshFailure:
    def test_refresh_without_cookie_returns_401(
        self, client: TestClient
    ) -> None:
        resp = client.post("/api/auth/refresh")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "missing_refresh_token"

    def test_refresh_with_expired_token_returns_401(
        self,
        client: TestClient,
        expired_refresh_token: RefreshToken,
    ) -> None:
        client.cookies.set(REFRESH_COOKIE, expired_refresh_token.id)
        resp = client.post("/api/auth/refresh")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "invalid_refresh_token"

    def test_refresh_with_already_revoked_token_returns_401(
        self,
        client: TestClient,
        revoked_refresh_token: RefreshToken,
    ) -> None:
        client.cookies.set(REFRESH_COOKIE, revoked_refresh_token.id)
        resp = client.post("/api/auth/refresh")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "invalid_refresh_token"

    def test_refresh_with_deleted_user_returns_401(
        self,
        client: TestClient,
        orphan_refresh_token: RefreshToken,
    ) -> None:
        # User row was never created (orphan refresh row). The use case
        # rejects with the SAME uniform 401 as other invalid-refresh
        # paths so we don't leak which check failed.
        client.cookies.set(REFRESH_COOKIE, orphan_refresh_token.id)
        resp = client.post("/api/auth/refresh")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "invalid_refresh_token"

    def test_refresh_with_unknown_cookie_value_returns_401(
        self, client: TestClient
    ) -> None:
        # Cookie value that doesn't match any DB row.
        client.cookies.set(REFRESH_COOKIE, "deadbeef" * 4)
        resp = client.post("/api/auth/refresh")
        assert resp.status_code == 401
        assert resp.json()["detail"] == "invalid_refresh_token"


# ---------------------------------------------------------------------------
# Atomicity / concurrency
# ---------------------------------------------------------------------------


class TestRefreshAtomicity:
    def test_same_refresh_cookie_cannot_be_used_twice(
        self,
        client: TestClient,
        test_user: User,
        refresh_tokens_repo: SQLiteRefreshTokensRepository,
    ) -> None:
        """Sequential redemption of the SAME refresh cookie: first 200,
        second 401.

        This is the security-load-bearing property of rotation: a leaked
        cookie can be used AT MOST once before the server detects the
        breach. ``rotate()`` runs revoke+insert inside a single
        ``BEGIN IMMEDIATE`` transaction, so by the time the second
        request looks up the cookie value, the row's ``revoked_at`` is
        set and ``is_active`` returns False → 401."""
        login = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": TEST_USER_PASSWORD},
        )
        assert login.status_code == 200
        original_cookie = client.cookies.get("susurra_refresh")
        assert original_cookie is not None

        # First redemption — succeeds, rotates the token.
        first = TestClient(client.app)
        first.cookies.set(REFRESH_COOKIE, original_cookie)
        r1 = first.post("/api/auth/refresh")
        assert r1.status_code == 200, r1.text

        # The original DB row is now revoked.
        old_row = refresh_tokens_repo.get_by_id(original_cookie)
        assert old_row is not None
        assert old_row.revoked_at is not None
        assert old_row.is_active is False

        # Second redemption with the SAME cookie value → 401.
        second = TestClient(client.app)
        second.cookies.set(REFRESH_COOKIE, original_cookie)
        r2 = second.post("/api/auth/refresh")
        assert r2.status_code == 401
        assert r2.json()["detail"] == "invalid_refresh_token"

    def test_rotate_revokes_old_and_inserts_new_in_single_transaction(
        self,
        refresh_tokens_repo: SQLiteRefreshTokensRepository,
        refresh_minter,
        test_user: User,
    ) -> None:
        """Repository-level test of ``rotate()``: the BEGIN IMMEDIATE
        block must produce BOTH a revoked old row AND a brand-new
        active row, with no half-states observable in between."""
        from datetime import datetime

        # Seed an active token.
        old = RefreshToken(
            id=refresh_minter.mint(),
            user_id=test_user.id,
            expires_at=refresh_minter.compute_expiry(),
            revoked_at=None,
            user_agent="pytest",
            ip="127.0.0.1",
            created_at=datetime.utcnow(),
        )
        refresh_tokens_repo.create(old)

        # Rotate to a new id.
        new = RefreshToken(
            id=refresh_minter.mint(),
            user_id=test_user.id,
            expires_at=refresh_minter.compute_expiry(),
            revoked_at=None,
            user_agent="pytest",
            ip="127.0.0.1",
            created_at=datetime.utcnow(),
        )
        refresh_tokens_repo.rotate(old.id, new)

        old_row = refresh_tokens_repo.get_by_id(old.id)
        new_row = refresh_tokens_repo.get_by_id(new.id)
        assert old_row is not None
        assert new_row is not None
        assert old_row.revoked_at is not None
        assert old_row.is_active is False
        assert new_row.revoked_at is None
        assert new_row.is_active is True
