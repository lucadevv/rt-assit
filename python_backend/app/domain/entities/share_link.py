"""ShareLink domain entity (B7 — Premium share links).

A short-id link that grants public (no-auth) access to a session. Permissions
control what the recipient can see (transcript only, with audio, full edit).
Optional expiration; revocable. Pure data — no framework dependencies."""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional


SharePermissions = Literal["transcript_only", "with_audio", "edit"]


@dataclass
class ShareLink:
    """A shareable link to a session.

    ``id`` is a 12-char URL-safe short id (``secrets.token_urlsafe(9)[:12]``).
    ``user_id`` is the creator/owner (multi-tenant). ``expires_at=None`` means
    the link never auto-expires; ``revoked_at=None`` means the link is still
    active. ``view_count`` increments on each public access."""

    id: str
    session_id: str
    user_id: str
    permissions: SharePermissions
    expires_at: Optional[datetime]
    revoked_at: Optional[datetime]
    view_count: int
    created_at: datetime

    @property
    def is_active(self) -> bool:
        """True iff the link is neither revoked nor expired."""
        if self.revoked_at is not None:
            return False
        if self.expires_at is not None and self.expires_at <= datetime.utcnow():
            return False
        return True
