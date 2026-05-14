"""RevokeShareLinkUseCase (B7 — Premium share links).

Soft-deletes a share link by setting ``revoked_at = now``. Owner-scoped:
a tenant cannot revoke another tenant's link."""
from __future__ import annotations

from app.application.ports.share_links_repository import ShareLinksRepository


class RevokeShareLinkUseCase:
    """Mark a share link as revoked (idempotent, owner-scoped).

    Returns True iff a row was updated (link exists + belongs to user_id +
    was not already revoked). Returns False otherwise — the router maps that
    to a 404 (link not found OR not authorised — same response so we don't
    leak existence to non-owners)."""

    def __init__(self, *, share_repo: ShareLinksRepository) -> None:
        self.share_repo = share_repo

    def execute(self, *, link_id: str, user_id: str) -> bool:
        return self.share_repo.revoke(link_id, user_id)
