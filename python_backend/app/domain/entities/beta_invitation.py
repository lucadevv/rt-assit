"""BetaInvitation domain entity.

A row in ``beta_invitations`` represents a founder-issued invite to a
LATAM dev to try the private beta. The associated user row (in
``users``) is created at invite time via the existing
``AdminCreateUserUseCase`` — ``user_id`` therefore is NEVER null on
creation, but the FK is ``ON DELETE SET NULL`` so historical invites
survive GDPR deletes."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class BetaInvitation:
    id: str
    email: str
    user_id: Optional[str]
    invited_at: datetime
    email_sent_at: Optional[datetime]
    invited_by_user_id: Optional[str]
