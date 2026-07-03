"""Integration tests for the auth middleware (Sprint B1).

Exercised through ``GET /api/me`` which is the simplest authed
endpoint that depends on ``get_current_user``.

Covers:
* Bearer header path — valid token → 200
* Cookie path — valid susurra_access → 200
* No auth at all (AUTH_MODE=custom) → 401
* Expired JWT → 401
* Tampered JWT → 401
* Bearer wins over cookie when both are present"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.entities.user import User
from app.presentation.api.cookies import ACCESS_COOKIE


# ---------------------------------------------------------------------------
# Valid auth → 200
# ---------------------------------------------------------------------------


class TestAuthMiddleware:
    def test_request_with_valid_bearer_returns_200(
        self,
        client: TestClient,
        test_user: User,
        valid_access_jwt: str,
    ) -> None:
        resp = client.get(
            "/api/me",
            headers={"Authorization": f"Bearer {valid_access_jwt}"},
        )
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == test_user.id
        assert body["email"] == test_user.email

    def test_request_with_valid_cookie_returns_200(
        self,
        authed_client: TestClient,
        test_user: User,
    ) -> None:
        # authed_client already has the susurra_access cookie set by
        # the login fixture — no Authorization header needed.
        resp = authed_client.get("/api/me")
        assert resp.status_code == 200, resp.text
        body = resp.json()
        assert body["id"] == test_user.id

    # -----------------------------------------------------------------
    # Missing / bad auth → 401
    # -----------------------------------------------------------------

    def test_request_with_no_auth_returns_401(
        self, client: TestClient
    ) -> None:
        # No Bearer + no cookie + AUTH_MODE=custom = 401.
        resp = client.get("/api/me")
        assert resp.status_code == 401
        # Spanish message preserved for NFR-9 compat.
        assert "Falta header Authorization" in resp.json()["detail"]

    def test_request_with_expired_jwt_returns_401(
        self, client: TestClient, expired_access_jwt: str
    ) -> None:
        resp = client.get(
            "/api/me",
            headers={"Authorization": f"Bearer {expired_access_jwt}"},
        )
        assert resp.status_code == 401

    def test_request_with_tampered_jwt_returns_401(
        self, client: TestClient, tampered_jwt: str
    ) -> None:
        # Modified payload → HMAC mismatch → validator returns None →
        # middleware translates to UnauthorizedError → 401.
        resp = client.get(
            "/api/me",
            headers={"Authorization": f"Bearer {tampered_jwt}"},
        )
        assert resp.status_code == 401

    def test_request_with_malformed_bearer_returns_401(
        self, client: TestClient
    ) -> None:
        # ``Authorization: NotBearer abc`` doesn't match the parser →
        # token resolves to None → middleware falls back to cookie
        # (also missing) → 401.
        resp = client.get(
            "/api/me",
            headers={"Authorization": "NotBearer abc"},
        )
        assert resp.status_code == 401

    # -----------------------------------------------------------------
    # Bearer vs cookie precedence
    # -----------------------------------------------------------------

    def test_bearer_wins_over_cookie_when_both_present(
        self,
        authed_client: TestClient,
        expired_access_jwt: str,
    ) -> None:
        """authed_client has a VALID cookie. We attach an EXPIRED Bearer
        header. Per middleware spec the header takes precedence, so the
        request must 401 — proving the cookie is NOT used as a fallback
        when the Bearer is present-but-bad."""
        # Sanity check: cookie alone works.
        cookie_only = authed_client.get("/api/me")
        assert cookie_only.status_code == 200

        # Bearer present → must be used (and fail) regardless of cookie.
        resp = authed_client.get(
            "/api/me",
            headers={"Authorization": f"Bearer {expired_access_jwt}"},
        )
        assert resp.status_code == 401, resp.text
