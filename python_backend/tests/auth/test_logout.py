"""Integration tests for ``POST /api/auth/logout`` (Sprint B1).

Covers:
* Happy path — 204 + DB-side revoke + cookies cleared on response
* Idempotency — no cookie / double-logout still returns 204"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.entities.user import User
from app.infrastructure.persistence.sqlite.refresh_tokens_repository import (
    SQLiteRefreshTokensRepository,
)
from app.presentation.api.cookies import REFRESH_COOKIE
from tests.auth.conftest import TEST_USER_PASSWORD


class TestLogout:
    def test_logout_returns_204(
        self, authed_client: TestClient
    ) -> None:
        resp = authed_client.post("/api/auth/logout")
        assert resp.status_code == 204
        # 204 No Content — body MUST be empty per RFC 7230 §3.3.2.
        assert resp.content == b""

    def test_logout_revokes_refresh_in_db(
        self,
        client: TestClient,
        test_user: User,
        refresh_tokens_repo: SQLiteRefreshTokensRepository,
    ) -> None:
        # Login to mint a refresh, then logout, then verify the row is
        # revoked in the DB (and therefore inactive on next refresh).
        login = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": TEST_USER_PASSWORD},
        )
        assert login.status_code == 200
        refresh_id = client.cookies.get("susurra_refresh")
        assert refresh_id is not None

        logout = client.post("/api/auth/logout")
        assert logout.status_code == 204

        row = refresh_tokens_repo.get_by_id(refresh_id)
        assert row is not None
        assert row.revoked_at is not None
        assert row.is_active is False

    def test_logout_clears_cookies_in_response(
        self, authed_client: TestClient
    ) -> None:
        resp = authed_client.post("/api/auth/logout")
        assert resp.status_code == 204

        # ``Response.delete_cookie`` writes Set-Cookie headers with
        # Max-Age=0 (or expires=epoch) for BOTH the access and refresh
        # cookies. The header order/case is not guaranteed; just check
        # the substrings.
        # ``TestClient`` lower-cases header names — but Set-Cookie may
        # appear multiple times, so use ``headers.get_list`` if
        # available, else fall back to the joined string.
        try:
            cookies = resp.headers.get_list("set-cookie")  # type: ignore[attr-defined]
        except AttributeError:
            cookies = [resp.headers.get("set-cookie", "")]
        joined = " | ".join(cookies)
        assert "susurra_access=" in joined
        assert "susurra_refresh=" in joined
        # Each cleared cookie carries Max-Age=0 OR an expires date in 1970.
        assert "Max-Age=0" in joined or "1970" in joined

    def test_logout_without_cookie_still_returns_204(
        self, client: TestClient
    ) -> None:
        # No prior login → no cookie. Logout is idempotent.
        resp = client.post("/api/auth/logout")
        assert resp.status_code == 204

    def test_double_logout_is_idempotent(
        self,
        client: TestClient,
        test_user: User,
    ) -> None:
        # Login then logout twice — both return 204; second one is a
        # no-op (revoking an already-revoked row is a no-op at the
        # repo layer).
        login = client.post(
            "/api/auth/login",
            json={"email": test_user.email, "password": TEST_USER_PASSWORD},
        )
        assert login.status_code == 200

        first = client.post("/api/auth/logout")
        assert first.status_code == 204

        # After the first logout, cookies are cleared on the response,
        # but ``TestClient`` may still hold the now-invalid value in its
        # jar. Either way: second call MUST also return 204.
        second = client.post("/api/auth/logout")
        assert second.status_code == 204
