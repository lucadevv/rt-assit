"""Tests for SqliteOAuthRepository (Meeting Frame foundation)."""
from __future__ import annotations

import sqlite3
import time
import uuid
from pathlib import Path

import pytest
from cryptography.fernet import Fernet

from app.domain.entities.oauth_credential import OAuthCredential
from app.infrastructure.persistence.sqlite.oauth_repository import (
    SqliteOAuthRepository,
)


# Fixed key for reproducible tests.
_TEST_FERNET_KEY = b"jHbHHmcrEKMqkKw8YVj3qB5dvFEPNVj1XLZeFx4tFA0="


def _init_schema(db_path: str) -> None:
    """Create just the oauth_credentials table for isolated tests."""
    with sqlite3.connect(db_path) as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS oauth_credentials (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                provider TEXT NOT NULL,
                access_token_enc BLOB NOT NULL,
                refresh_token_enc BLOB NOT NULL,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                UNIQUE(user_id, provider)
            );
            CREATE INDEX IF NOT EXISTS idx_oauth_user_provider
                ON oauth_credentials(user_id, provider);
            """
        )
        conn.commit()


@pytest.fixture()
def repo(tmp_path: Path) -> SqliteOAuthRepository:
    db_path = str(tmp_path / "oauth_test.db")
    _init_schema(db_path)
    return SqliteOAuthRepository(db_path=db_path, fernet_key=_TEST_FERNET_KEY)


def _make_credential(
    *,
    user_id: str = "user-1",
    provider: str = "google",
    access_token: str = "access-abc",
    refresh_token: str = "refresh-xyz",
) -> OAuthCredential:
    now_ms = int(time.time() * 1000)
    return OAuthCredential(
        id=str(uuid.uuid4()),
        user_id=user_id,
        provider=provider,  # type: ignore[arg-type]
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=now_ms + 3600_000,
        created_at=now_ms,
        updated_at=now_ms,
    )


def test_save_and_get_round_trips_with_decrypted_values(
    repo: SqliteOAuthRepository,
) -> None:
    cred = _make_credential(
        access_token="plain-access", refresh_token="plain-refresh"
    )
    repo.save(cred)

    loaded = repo.get("user-1", "google")
    assert loaded is not None
    assert loaded.access_token == "plain-access"
    assert loaded.refresh_token == "plain-refresh"
    assert loaded.provider == "google"
    assert loaded.user_id == "user-1"
    assert loaded.expires_at == cred.expires_at


def test_save_is_upsert_by_user_and_provider(
    repo: SqliteOAuthRepository, tmp_path: Path
) -> None:
    first = _make_credential(
        access_token="old-access", refresh_token="old-refresh"
    )
    repo.save(first)

    # Same user + provider, new tokens — should overwrite the row.
    second = _make_credential(
        access_token="new-access", refresh_token="new-refresh"
    )
    repo.save(second)

    loaded = repo.get("user-1", "google")
    assert loaded is not None
    assert loaded.access_token == "new-access"
    assert loaded.refresh_token == "new-refresh"

    # Only one row should exist for that (user, provider) pair.
    with sqlite3.connect(str(tmp_path / "oauth_test.db")) as conn:
        count = conn.execute(
            "SELECT COUNT(*) FROM oauth_credentials WHERE user_id = ? AND provider = ?",
            ("user-1", "google"),
        ).fetchone()[0]
    assert count == 1


def test_list_for_user_returns_only_owned(
    repo: SqliteOAuthRepository,
) -> None:
    repo.save(_make_credential(user_id="user-A", provider="google"))
    repo.save(_make_credential(user_id="user-A", provider="microsoft"))
    repo.save(_make_credential(user_id="user-B", provider="zoom"))

    a_creds = repo.list_for_user("user-A")
    assert {c.provider for c in a_creds} == {"google", "microsoft"}
    assert all(c.user_id == "user-A" for c in a_creds)

    b_creds = repo.list_for_user("user-B")
    assert len(b_creds) == 1
    assert b_creds[0].provider == "zoom"


def test_delete_removes_row(repo: SqliteOAuthRepository) -> None:
    repo.save(_make_credential(user_id="user-1", provider="google"))
    assert repo.get("user-1", "google") is not None

    repo.delete("user-1", "google")
    assert repo.get("user-1", "google") is None


def test_fernet_encryption_round_trip() -> None:
    """Sanity check that the key + Fernet contract behaves as expected."""
    f = Fernet(_TEST_FERNET_KEY)
    plaintext = "super-secret-token-value"
    ct = f.encrypt(plaintext.encode("utf-8"))
    assert ct != plaintext.encode("utf-8")
    assert f.decrypt(ct).decode("utf-8") == plaintext
