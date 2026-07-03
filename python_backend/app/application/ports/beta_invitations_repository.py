"""Repository port for ``beta_invitations`` persistence.

A separate table (not piggy-backing on ``users``) so we can track invite
metadata — email-delivery status, founder-attribution, last-login join —
without polluting the auth-critical users row."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.beta_invitation import BetaInvitation


class BetaInvitationsRepository(ABC):
    @abstractmethod
    def create(self, invitation: BetaInvitation) -> BetaInvitation:
        """Insert a new invitation row. Caller mints the id."""
        ...

    @abstractmethod
    def list(self, limit: int = 100) -> list[BetaInvitation]:
        """Return invitations ordered DESC by ``invited_at``."""
        ...

    @abstractmethod
    def mark_email_sent(self, invitation_id: str) -> None:
        """Stamp ``email_sent_at = now()`` after a successful Resend call.

        Idempotent — re-stamping an already-marked row is harmless."""
        ...

    @abstractmethod
    def list_user_last_login_map(
        self, user_ids: list[str]
    ) -> dict[str, Optional[str]]:
        """Return ``{user_id: last_login_iso_or_None}`` for the given ids.

        Computed lazily from the ``users.updated_at`` proxy or the
        ``refresh_tokens.created_at`` MAX(). Implementations choose the
        best signal available in their backing store."""
        ...
