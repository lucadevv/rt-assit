"""Tests for the housekeeping ``prune_expired`` cron path (Sprint B1).

The cron itself is registered in ``app/main.py`` via APScheduler; what
we're locking down here is the repository contract it depends on —
expired rows are deleted and the count is reported back. Valid (active)
and revoked-but-still-in-window rows are NOT touched."""
from __future__ import annotations

from datetime import datetime, timedelta

from app.domain.entities.refresh_token import RefreshToken
from app.domain.entities.user import User
from app.infrastructure.auth.opaque_refresh_token_minter import (
    OpaqueRefreshTokenMinter,
)
from app.infrastructure.persistence.sqlite.refresh_tokens_repository import (
    SQLiteRefreshTokensRepository,
)


def _make_token(
    *,
    minter: OpaqueRefreshTokenMinter,
    user_id: str,
    expires_at: datetime,
    revoked_at: datetime | None = None,
) -> RefreshToken:
    return RefreshToken(
        id=minter.mint(),
        user_id=user_id,
        expires_at=expires_at,
        revoked_at=revoked_at,
        user_agent="pytest-prune",
        ip="127.0.0.1",
        created_at=datetime.utcnow(),
    )


class TestPruneExpiredRefreshTokens:
    def test_prune_removes_expired_rows_only(
        self,
        refresh_tokens_repo: SQLiteRefreshTokensRepository,
        refresh_minter: OpaqueRefreshTokenMinter,
        test_user: User,
    ) -> None:
        # 2 expired rows + 1 still-valid row.
        expired_a = _make_token(
            minter=refresh_minter,
            user_id=test_user.id,
            expires_at=datetime.utcnow() - timedelta(days=1),
        )
        expired_b = _make_token(
            minter=refresh_minter,
            user_id=test_user.id,
            expires_at=datetime.utcnow() - timedelta(hours=1),
        )
        active = _make_token(
            minter=refresh_minter,
            user_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        refresh_tokens_repo.create(expired_a)
        refresh_tokens_repo.create(expired_b)
        refresh_tokens_repo.create(active)

        deleted = refresh_tokens_repo.prune_expired()

        assert deleted == 2
        assert refresh_tokens_repo.get_by_id(expired_a.id) is None
        assert refresh_tokens_repo.get_by_id(expired_b.id) is None
        # The valid row survives — prune is NEVER allowed to touch
        # active sessions.
        survivor = refresh_tokens_repo.get_by_id(active.id)
        assert survivor is not None
        assert survivor.is_active is True

    def test_prune_returns_zero_when_no_expired_rows(
        self,
        refresh_tokens_repo: SQLiteRefreshTokensRepository,
        refresh_minter: OpaqueRefreshTokenMinter,
        test_user: User,
    ) -> None:
        # Only active + revoked-but-not-expired rows. prune_expired
        # ignores ``revoked_at`` — it only looks at ``expires_at``.
        active = _make_token(
            minter=refresh_minter,
            user_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(days=30),
        )
        revoked = _make_token(
            minter=refresh_minter,
            user_id=test_user.id,
            expires_at=datetime.utcnow() + timedelta(days=30),
            revoked_at=datetime.utcnow(),
        )
        refresh_tokens_repo.create(active)
        refresh_tokens_repo.create(revoked)

        deleted = refresh_tokens_repo.prune_expired()

        assert deleted == 0
        assert refresh_tokens_repo.get_by_id(active.id) is not None
        assert refresh_tokens_repo.get_by_id(revoked.id) is not None
