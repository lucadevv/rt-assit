"""Repository port for share link persistence (B7 — Premium share links)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.share_link import ShareLink


class ShareLinksRepository(ABC):
    """Abstract share-links store. Implementations: SQLite (current), Postgres (future).

    Multi-tenant safety: ``revoke`` requires ``user_id`` so a tenant cannot
    revoke another tenant's link. ``list_for_session`` and ``list_for_user``
    are scoped to the owner. ``get`` is unscoped because the public-access
    endpoint resolves the link before knowing the owner."""

    @abstractmethod
    def create(self, link: ShareLink) -> ShareLink:
        """Insert a new share link row."""
        ...

    @abstractmethod
    def get(self, link_id: str) -> Optional[ShareLink]:
        """Fetch by short-id. ``None`` if not found.

        NOT multi-tenant scoped — the public endpoint hits this without auth.
        Callers MUST validate ``is_active`` (or ``revoked_at``/``expires_at``)
        before serving session data."""
        ...

    @abstractmethod
    def list_for_session(
        self, session_id: str, user_id: str
    ) -> list[ShareLink]:
        """All links for a given session, scoped to the owner."""
        ...

    @abstractmethod
    def list_for_user(
        self, user_id: str, *, limit: int = 50, offset: int = 0
    ) -> list[ShareLink]:
        """All links the user owns, paginated, most-recent-first."""
        ...

    @abstractmethod
    def revoke(self, link_id: str, user_id: str) -> bool:
        """Soft-delete via ``revoked_at = now``. Owner-scoped.

        Returns True iff a row was updated (ie. matched the user_id).
        Idempotent: revoking an already-revoked link is a no-op (returns False)."""
        ...

    @abstractmethod
    def increment_view_count(self, link_id: str) -> None:
        """Atomic ``UPDATE share_links SET view_count = view_count + 1 WHERE id = ?``.

        Best-effort: silently no-ops if the link does not exist. Race-safe
        without an explicit transaction because the SQL is single-statement."""
        ...
