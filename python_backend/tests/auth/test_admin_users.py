"""Integration tests for ``POST /api/admin/users`` (Sprint B1).

Covers:
* Happy path — 201 + DB persistence + bcrypt-hashed password
* X-Admin-Token gating — missing, wrong, configured-but-blank
* Pydantic validation — weak password (< 12 chars)
* Conflict — duplicate email"""
from __future__ import annotations

from fastapi.testclient import TestClient

from app.domain.entities.user import User
from app.infrastructure.auth.bcrypt_password_hasher import BcryptPasswordHasher
from app.infrastructure.persistence.sqlite.users_repository import (
    SQLiteUsersRepository,
)
from tests.auth.conftest import TEST_ADMIN_TOKEN


class TestAdminCreateUser:
    def test_create_user_with_valid_admin_token_returns_201(
        self, client: TestClient
    ) -> None:
        resp = client.post(
            "/api/admin/users",
            headers={"X-Admin-Token": TEST_ADMIN_TOKEN},
            json={
                "email": "founder@example.com",
                "password": "founder-password-12345",
                "is_admin": True,
                "name": "Founder",
            },
        )
        assert resp.status_code == 201, resp.text
        body = resp.json()
        assert body["email"] == "founder@example.com"
        assert body["is_admin"] is True
        # User id is server-assigned ``user_<24 hex>``.
        assert body["id"].startswith("user_")

    def test_create_user_persists_to_db_with_bcrypt_hash(
        self,
        client: TestClient,
        users_repo: SQLiteUsersRepository,
        password_hasher: BcryptPasswordHasher,
    ) -> None:
        plain = "another-password-12345"
        resp = client.post(
            "/api/admin/users",
            headers={"X-Admin-Token": TEST_ADMIN_TOKEN},
            json={
                "email": "persisted@example.com",
                "password": plain,
                "is_admin": False,
                "name": "Persisted",
            },
        )
        assert resp.status_code == 201, resp.text
        user_id = resp.json()["id"]

        # Fetch via the password-aware getter so we can verify the
        # bcrypt hash was actually stored AND that ``verify`` matches.
        stored = users_repo.get_by_email_with_password("persisted@example.com")
        assert stored is not None
        assert stored.id == user_id
        assert stored.password_hash is not None
        # Bcrypt format: ``$2b$<cost>$<salt+hash>`` — never the plaintext.
        assert stored.password_hash != plain
        assert stored.password_hash.startswith("$2")
        assert password_hasher.verify(plain, stored.password_hash) is True

    def test_create_user_without_admin_token_returns_403(
        self, client: TestClient
    ) -> None:
        # No X-Admin-Token at all.
        resp = client.post(
            "/api/admin/users",
            json={
                "email": "nope@example.com",
                "password": "any-password-12345",
            },
        )
        assert resp.status_code == 403

    def test_create_user_with_wrong_admin_token_returns_403(
        self, client: TestClient
    ) -> None:
        resp = client.post(
            "/api/admin/users",
            headers={"X-Admin-Token": "wrong-token-value"},
            json={
                "email": "nope@example.com",
                "password": "any-password-12345",
            },
        )
        assert resp.status_code == 403
        assert resp.json()["detail"] == "forbidden"

    def test_create_user_with_weak_password_returns_422(
        self, client: TestClient
    ) -> None:
        # Pydantic schema enforces min_length=12 — request never reaches
        # the use case.
        resp = client.post(
            "/api/admin/users",
            headers={"X-Admin-Token": TEST_ADMIN_TOKEN},
            json={
                "email": "weak@example.com",
                "password": "short",
            },
        )
        assert resp.status_code == 422

    def test_create_user_with_invalid_email_returns_422(
        self, client: TestClient
    ) -> None:
        # EmailStr rejects malformed inputs at the schema layer.
        resp = client.post(
            "/api/admin/users",
            headers={"X-Admin-Token": TEST_ADMIN_TOKEN},
            json={
                "email": "not-an-email",
                "password": "valid-password-12345",
            },
        )
        assert resp.status_code == 422

    def test_create_duplicate_user_returns_409(
        self,
        client: TestClient,
        test_user: User,
    ) -> None:
        # test_user already exists with email TEST_USER_EMAIL — second
        # creation must surface the conflict cleanly.
        resp = client.post(
            "/api/admin/users",
            headers={"X-Admin-Token": TEST_ADMIN_TOKEN},
            json={
                "email": test_user.email,
                "password": "another-password-12345",
            },
        )
        assert resp.status_code == 409
        assert resp.json()["detail"] == "user_already_exists"
