"""Repository port for refresh-token persistence (Auth Fase A).

Refresh tokens are NOT JWTs — they're opaque random strings stored as
DB rows. The repository is the only authority on whether a refresh
token is valid: a missing or revoked row means 401 even if the cookie
value looks well-formed."""
from __future__ import annotations

from typing import Optional, Protocol, runtime_checkable

from app.domain.entities.refresh_token import RefreshToken


@runtime_checkable
class RefreshTokensRepository(Protocol):
    """Port for the refresh-tokens store.

    Implementations: SQLite (current), Postgres / Redis (future).
    Method semantics:
      - ``create``: insert a fresh row. Returns the persisted entity.
      - ``get_by_id``: lookup by the opaque id (= cookie value).
      - ``revoke``: soft-delete (sets revoked_at = now). Idempotent —
        revoking an already-revoked token is a no-op.
      - ``revoke_all_for_user``: nuclear option (logout-everywhere /
        password change). Idempotent.
      - ``prune_expired``: housekeeping. Returns count of deleted rows.
        Safe to skip — expired rows are still rejected by ``is_active``."""

    def create(self, token: RefreshToken) -> RefreshToken: ...

    def get_by_id(self, token_id: str) -> Optional[RefreshToken]: ...

    def revoke(self, token_id: str) -> None: ...

    def revoke_all_for_user(self, user_id: str) -> None: ...

    def prune_expired(self) -> int: ...

    def rotate(self, old_id: str, new_token: RefreshToken) -> RefreshToken:
        """Atomically revoke ``old_id`` AND insert ``new_token`` in a
        single transaction. Either BOTH happen or NEITHER does — closes
        the race where ``revoke()`` succeeds and ``create()`` then fails,
        leaving the user locked out (old token dead, no new one issued).

        Concurrent refresh attempts: only the first caller's transaction
        succeeds in revoking the (then-active) row; subsequent callers'
        UPDATE matches zero rows because ``revoked_at IS NULL`` is no
        longer satisfied. The use-case re-reads ``is_active`` BEFORE
        calling ``rotate`` so the second caller hits the validation 401
        path; the BEGIN IMMEDIATE inside the transaction serialises
        writers so we never get two new rows with split lineage."""
        ...
