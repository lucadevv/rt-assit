"""Shared fixtures for the Susurra auth test suite (Sprint B1).

Strategy
--------
Each test gets a FRESH in-process SQLite DB at a tmp_path location so
the rows from previous tests can't leak in. We mount only the auth +
admin + me routers (no /api/sessions, no billing, no LLM) so the test
boots fast and depends on as little infra as possible.

Key plumbing tricks
-------------------

* ``DB_PATH`` in ``app.infrastructure.persistence.sqlite.db`` is bound at
  module import time. We monkeypatch the module attribute per test so
  every ``get_conn()`` opens the test DB. Singletons (``@lru_cache`` in
  ``presentation.deps``) are stateless wrt the path because ``get_conn``
  reads the module attribute on every call.
* ``CUSTOM_AUTH_JWT_SECRET`` is read by ``JwtSignerAdapter`` on every
  sign / verify call, so a monkeypatched env var takes effect immediately.
* The ``@lru_cache`` on ``get_auth_validator`` IS path-sensitive (the
  validator owns a ``SQLiteUsersRepository`` instance) but that repo is
  stateless wrt DB path too, so we just clear the lru-cache once per
  fixture session to be safe.
"""
from __future__ import annotations

import os
import time
import uuid
from datetime import datetime, timedelta
from typing import Iterator

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.application.use_cases.admin_create_user import AdminCreateUserUseCase
from app.application.use_cases.login_user import LoginUserUseCase
from app.application.use_cases.logout_user import LogoutUserUseCase
from app.application.use_cases.refresh_access_token import (
    RefreshAccessTokenUseCase,
)
from app.domain.entities.refresh_token import RefreshToken
from app.domain.entities.user import User
from app.infrastructure.auth.bcrypt_password_hasher import BcryptPasswordHasher
from app.infrastructure.auth.custom_auth_validator import CustomAuthValidator
from app.infrastructure.auth.jwt_signer_adapter import JwtSignerAdapter
from app.infrastructure.auth.opaque_refresh_token_minter import (
    OpaqueRefreshTokenMinter,
)
from app.infrastructure.persistence.sqlite import db as _db_module
from app.infrastructure.persistence.sqlite.refresh_tokens_repository import (
    SQLiteRefreshTokensRepository,
)
from app.infrastructure.persistence.sqlite.users_repository import (
    SQLiteUsersRepository,
)
from app.presentation.api import admin_router as admin_router_module
from app.presentation.api import auth_router as auth_router_module
from app.presentation.api import me_router as me_router_module
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_admin_create_user_use_case,
    get_auth_validator,
    get_ensure_user_exists_use_case,
    get_login_user_use_case,
    get_logout_user_use_case,
    get_refresh_access_token_use_case,
    get_refresh_tokens_repository,
    get_users_repository,
)


# Constants used across the suite — kept here so all tests assert against
# the same values without re-deriving them from env every time.
TEST_JWT_SECRET = "test-jwt-secret-with-at-least-32-bytes-of-entropy-x"
TEST_ADMIN_TOKEN = "test-admin-token-32-bytes-of-entropy-here-xx"
TEST_USER_EMAIL = "test@example.com"
TEST_USER_PASSWORD = "test-password-12345"


# ---------------------------------------------------------------------------
# Core DB + env bootstrap
# ---------------------------------------------------------------------------


@pytest.fixture()
def _patched_env(
    monkeypatch: pytest.MonkeyPatch, tmp_path
) -> Iterator[None]:
    """Set every env var the auth flow reads + point DB_PATH at a fresh file.

    Runs before any other fixture so the validator / signer / cookies
    helpers read consistent values."""
    # AUTH_MODE=custom so /api/auth/* runs the real flow (not dev sentinel).
    monkeypatch.setenv("AUTH_MODE", "custom")
    monkeypatch.setenv("CUSTOM_AUTH_JWT_SECRET", TEST_JWT_SECRET)
    monkeypatch.setenv("SUSURRA_ADMIN_TOKEN", TEST_ADMIN_TOKEN)
    monkeypatch.setenv("RT_GO_SERVICE_TOKEN", "test-rtgo-service-token")
    # Cookies module branches on SUSURRA_ENV ("dev" → SameSite=Lax,
    # Secure=false). Pin to dev so the response cookies are predictable.
    monkeypatch.setenv("SUSURRA_ENV", "dev")

    # Repoint the DB at a per-test file. Patching the module attribute is
    # safer than re-importing — every ``get_conn()`` reads
    # ``db.DB_PATH`` afresh at call time.
    test_db = tmp_path / "auth_test.db"
    monkeypatch.setattr(_db_module, "DB_PATH", test_db)

    # Bootstrap schema. ``init_db()`` is idempotent — safe to call into a
    # fresh file.
    _db_module.init_db()

    # The auth_validator lru_cache may hold a stale validator built with
    # the previous test's DB. Stateless wrt DB path in practice, but
    # clear to be explicit.
    get_auth_validator.cache_clear()

    yield None


# ---------------------------------------------------------------------------
# Repos / services (built fresh per test so they use the patched DB)
# ---------------------------------------------------------------------------


@pytest.fixture()
def users_repo(_patched_env: None) -> SQLiteUsersRepository:
    return SQLiteUsersRepository()


@pytest.fixture()
def refresh_tokens_repo(_patched_env: None) -> SQLiteRefreshTokensRepository:
    return SQLiteRefreshTokensRepository()


@pytest.fixture()
def password_hasher() -> BcryptPasswordHasher:
    return BcryptPasswordHasher()


@pytest.fixture()
def jwt_signer(_patched_env: None) -> JwtSignerAdapter:
    return JwtSignerAdapter()


@pytest.fixture()
def refresh_minter() -> OpaqueRefreshTokenMinter:
    return OpaqueRefreshTokenMinter()


# ---------------------------------------------------------------------------
# Use cases — built per-test so DI uses the test repos directly. We expose
# them for unit-style tests that bypass the HTTP layer (cron prune,
# repository assertions, etc.).
# ---------------------------------------------------------------------------


@pytest.fixture()
def login_use_case(
    users_repo: SQLiteUsersRepository,
    refresh_tokens_repo: SQLiteRefreshTokensRepository,
    jwt_signer: JwtSignerAdapter,
    password_hasher: BcryptPasswordHasher,
    refresh_minter: OpaqueRefreshTokenMinter,
) -> LoginUserUseCase:
    return LoginUserUseCase(
        users_repo=users_repo,
        refresh_tokens_repo=refresh_tokens_repo,
        jwt_signer=jwt_signer,
        password_hasher=password_hasher,
        refresh_minter=refresh_minter,
    )


@pytest.fixture()
def refresh_use_case(
    users_repo: SQLiteUsersRepository,
    refresh_tokens_repo: SQLiteRefreshTokensRepository,
    jwt_signer: JwtSignerAdapter,
    refresh_minter: OpaqueRefreshTokenMinter,
) -> RefreshAccessTokenUseCase:
    return RefreshAccessTokenUseCase(
        users_repo=users_repo,
        refresh_tokens_repo=refresh_tokens_repo,
        jwt_signer=jwt_signer,
        refresh_minter=refresh_minter,
    )


@pytest.fixture()
def logout_use_case(
    refresh_tokens_repo: SQLiteRefreshTokensRepository,
) -> LogoutUserUseCase:
    return LogoutUserUseCase(refresh_tokens_repo=refresh_tokens_repo)


@pytest.fixture()
def admin_create_use_case(
    users_repo: SQLiteUsersRepository,
    password_hasher: BcryptPasswordHasher,
) -> AdminCreateUserUseCase:
    return AdminCreateUserUseCase(
        users_repo=users_repo, password_hasher=password_hasher
    )


# ---------------------------------------------------------------------------
# FastAPI app + TestClient — minimal mount of the auth surface
# ---------------------------------------------------------------------------


@pytest.fixture()
def app(
    _patched_env: None,
    users_repo: SQLiteUsersRepository,
    refresh_tokens_repo: SQLiteRefreshTokensRepository,
    jwt_signer: JwtSignerAdapter,
    password_hasher: BcryptPasswordHasher,
    refresh_minter: OpaqueRefreshTokenMinter,
) -> FastAPI:
    """Minimal app with auth + admin + me routers.

    Dep overrides keep each request scoped to the per-test repos. We do
    NOT mount /api/sessions or any LLM-dependent router — the auth
    layer's contract is fully testable in isolation, which is the whole
    point of dependency inversion."""
    fastapi_app = FastAPI()
    fastapi_app.include_router(auth_router_module.router)
    fastapi_app.include_router(admin_router_module.router)
    fastapi_app.include_router(me_router_module.router)

    # Wire the use-case factories to use the test instances directly so
    # we never accidentally hit ``/app/data/rtassist.db`` from the
    # singleton lru_cache.
    fastapi_app.dependency_overrides[get_users_repository] = (
        lambda: users_repo
    )
    fastapi_app.dependency_overrides[get_refresh_tokens_repository] = (
        lambda: refresh_tokens_repo
    )
    fastapi_app.dependency_overrides[get_login_user_use_case] = (
        lambda: LoginUserUseCase(
            users_repo=users_repo,
            refresh_tokens_repo=refresh_tokens_repo,
            jwt_signer=jwt_signer,
            password_hasher=password_hasher,
            refresh_minter=refresh_minter,
        )
    )
    fastapi_app.dependency_overrides[get_refresh_access_token_use_case] = (
        lambda: RefreshAccessTokenUseCase(
            users_repo=users_repo,
            refresh_tokens_repo=refresh_tokens_repo,
            jwt_signer=jwt_signer,
            refresh_minter=refresh_minter,
        )
    )
    fastapi_app.dependency_overrides[get_logout_user_use_case] = (
        lambda: LogoutUserUseCase(refresh_tokens_repo=refresh_tokens_repo)
    )
    fastapi_app.dependency_overrides[get_admin_create_user_use_case] = (
        lambda: AdminCreateUserUseCase(
            users_repo=users_repo, password_hasher=password_hasher
        )
    )
    # Middleware path: get_current_user uses the auth validator + the
    # ensure_user_exists use case. Both need to read from the test DB.
    fastapi_app.dependency_overrides[get_auth_validator] = (
        lambda: CustomAuthValidator(
            users_repo=users_repo, jwt_signer=jwt_signer
        )
    )
    # ensure_user_exists takes a UsersRepository — already overridden
    # above; FastAPI nests the override automatically.

    # Best-effort: middleware also tries to call ``build_start_trial_use_case``
    # which depends on the full billing stack. The middleware swallows
    # the exception so it never blocks auth, but we can sidestep the
    # noise by ensuring SUSURRA_ENV stays in dev (skips heavy paths) —
    # already set in _patched_env.

    return fastapi_app


@pytest.fixture()
def client(app: FastAPI) -> TestClient:
    return TestClient(app)


# ---------------------------------------------------------------------------
# Domain fixtures — users + tokens
# ---------------------------------------------------------------------------


@pytest.fixture()
def test_user(
    users_repo: SQLiteUsersRepository,
    password_hasher: BcryptPasswordHasher,
) -> User:
    """A pre-seeded user with a known bcrypt password.

    Uses the repository directly (not the admin endpoint) so the fixture
    is fast and independent from the admin-token wiring under test."""
    user_id = f"user_test_{uuid.uuid4().hex[:16]}"
    return users_repo.create_with_password(
        user_id=user_id,
        email=TEST_USER_EMAIL,
        password_hash=password_hasher.hash(TEST_USER_PASSWORD),
        is_admin=False,
        name="Test User",
    )


@pytest.fixture()
def user_without_password(
    users_repo: SQLiteUsersRepository,
) -> User:
    """A user seeded WITHOUT a password_hash — mirrors the legacy
    dev_default / Clerk-only users from before the AUTH_MODE=custom
    migration. They must NEVER be able to log in via the custom flow."""
    return users_repo.upsert(
        user_id=f"user_legacy_{uuid.uuid4().hex[:16]}",
        email="legacy@example.com",
        name="Legacy User",
        avatar_url=None,
    )


@pytest.fixture()
def authed_client(
    client: TestClient, test_user: User
) -> TestClient:
    """A TestClient that has already logged in — auth cookies are
    persisted in the underlying cookie jar so subsequent requests carry
    them automatically."""
    resp = client.post(
        "/api/auth/login",
        json={"email": test_user.email, "password": TEST_USER_PASSWORD},
    )
    assert resp.status_code == 200, resp.text
    return client


@pytest.fixture()
def valid_access_jwt(
    test_user: User, jwt_signer: JwtSignerAdapter
) -> str:
    """A freshly-signed access JWT for ``test_user``. Used to exercise
    the Bearer-header branch of the auth middleware without going
    through /login."""
    return jwt_signer.sign(
        user_id=test_user.id,
        email=test_user.email,
        is_admin=test_user.is_admin,
    )


@pytest.fixture()
def expired_access_jwt(test_user: User) -> str:
    """Hand-rolled JWT with an ``exp`` in the past. The adapter normally
    refuses to mint these (TTL is fixed at +15min), so we build the
    payload directly with the same secret."""
    import jwt as pyjwt

    now = int(time.time())
    payload = {
        "sub": test_user.id,
        "email": test_user.email,
        "is_admin": test_user.is_admin,
        "iat": now - 7200,
        "exp": now - 3600,  # 1 hour in the past
    }
    return pyjwt.encode(payload, TEST_JWT_SECRET, algorithm="HS256")


@pytest.fixture()
def tampered_jwt(valid_access_jwt: str) -> str:
    """A JWT whose payload was modified after signing → signature mismatch.

    We flip a byte in the middle segment (payload). pyjwt rejects this
    with ``InvalidSignatureError`` which the validator collapses to
    UnauthorizedError → 401."""
    parts = valid_access_jwt.split(".")
    assert len(parts) == 3
    # Replace a character in the payload segment (which is base64url'd
    # JSON). Any single-character flip invalidates the HMAC.
    payload = parts[1]
    tampered_payload = (
        payload[:-1] + ("A" if payload[-1] != "A" else "B")
    )
    return ".".join([parts[0], tampered_payload, parts[2]])


@pytest.fixture()
def valid_refresh_token(
    refresh_tokens_repo: SQLiteRefreshTokensRepository,
    refresh_minter: OpaqueRefreshTokenMinter,
    test_user: User,
) -> RefreshToken:
    """An ACTIVE refresh-token row inserted directly into the DB."""
    token = RefreshToken(
        id=refresh_minter.mint(),
        user_id=test_user.id,
        expires_at=refresh_minter.compute_expiry(),
        revoked_at=None,
        user_agent="pytest",
        ip="127.0.0.1",
        created_at=datetime.utcnow(),
    )
    return refresh_tokens_repo.create(token)


@pytest.fixture()
def expired_refresh_token(
    refresh_tokens_repo: SQLiteRefreshTokensRepository,
    refresh_minter: OpaqueRefreshTokenMinter,
    test_user: User,
) -> RefreshToken:
    """A refresh-token row whose ``expires_at`` is in the past."""
    token = RefreshToken(
        id=refresh_minter.mint(),
        user_id=test_user.id,
        expires_at=datetime.utcnow() - timedelta(days=1),
        revoked_at=None,
        user_agent="pytest",
        ip="127.0.0.1",
        created_at=datetime.utcnow() - timedelta(days=31),
    )
    return refresh_tokens_repo.create(token)


@pytest.fixture()
def revoked_refresh_token(
    refresh_tokens_repo: SQLiteRefreshTokensRepository,
    refresh_minter: OpaqueRefreshTokenMinter,
    test_user: User,
) -> RefreshToken:
    """A refresh-token row that has been explicitly revoked — should
    fail the ``is_active`` check on /api/auth/refresh."""
    token = RefreshToken(
        id=refresh_minter.mint(),
        user_id=test_user.id,
        expires_at=refresh_minter.compute_expiry(),
        revoked_at=None,
        user_agent="pytest",
        ip="127.0.0.1",
        created_at=datetime.utcnow(),
    )
    refresh_tokens_repo.create(token)
    refresh_tokens_repo.revoke(token.id)
    return token


@pytest.fixture()
def orphan_refresh_token(
    refresh_tokens_repo: SQLiteRefreshTokensRepository,
    refresh_minter: OpaqueRefreshTokenMinter,
) -> RefreshToken:
    """A refresh-token row whose ``user_id`` points at a user that
    doesn't exist. Mirrors the 'user deleted mid-session' edge case —
    the FK has ON DELETE CASCADE in prod but we insert directly here to
    simulate the half-state."""
    # Use a user_id that doesn't exist in the users table. SQLite's
    # foreign keys are enabled, so we have to insert via a path that
    # bypasses the FK — write the row via a raw connection with FKs off
    # for the duration of the insert.
    token_id = refresh_minter.mint()
    bogus_user_id = "user_does_not_exist_xxxxxxxxxxxx"
    with _db_module.get_conn() as conn:
        conn.execute("PRAGMA foreign_keys = OFF")
        conn.execute(
            """INSERT INTO refresh_tokens
               (id, user_id, expires_at, revoked_at, user_agent, ip, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?)""",
            (
                token_id,
                bogus_user_id,
                (datetime.utcnow() + timedelta(days=30)).isoformat(),
                None,
                "pytest",
                "127.0.0.1",
                datetime.utcnow().isoformat(),
            ),
        )
        conn.commit()
    fetched = refresh_tokens_repo.get_by_id(token_id)
    assert fetched is not None
    return fetched
