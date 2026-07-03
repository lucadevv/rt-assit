"""Invite a beta user — generate password, create the user, send the
welcome email, persist the invitation row.

Email delivery is best-effort: a Resend outage MUST NOT prevent the
founder from onboarding the user. We always create the user + the
invitation row first; if Resend fails we leave ``email_sent_at = NULL``
so the founder sees the row tagged as "no entregado" in the admin UI
and can re-send manually.
"""
from __future__ import annotations

import logging
import uuid
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

from app.application.ports.beta_invitations_repository import (
    BetaInvitationsRepository,
)
from app.application.ports.email_sender import EmailSender
from app.application.use_cases.admin_create_user import AdminCreateUserUseCase
from app.domain.entities.beta_invitation import BetaInvitation
from app.infrastructure.auth.random_password_generator import generate_password


logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class InviteBetaUserResult:
    invitation_id: str
    user_id: str
    email: str
    email_sent: bool


@dataclass
class InviteBetaUserUseCase:
    admin_create_user_use_case: AdminCreateUserUseCase
    invitations_repo: BetaInvitationsRepository
    email_sender: EmailSender
    sign_in_url: str
    from_email: Optional[str] = None

    async def execute(
        self,
        *,
        email: str,
        is_admin: bool = False,
        invited_by_user_id: Optional[str] = None,
    ) -> InviteBetaUserResult:
        password = generate_password()

        # 1. Create user (raises ConflictError if email already exists —
        # router maps that to a 409). AdminCreateUserUseCase.execute is
        # SYNC (no I/O abstraction at the moment) — call it directly.
        user = self.admin_create_user_use_case.execute(
            email=email,
            password=password,
            is_admin=is_admin,
        )

        # 2. Persist invitation row BEFORE attempting email send so we
        # can stamp email_sent_at on success without losing the row on
        # a Resend failure.
        invitation = BetaInvitation(
            id=f"inv_{uuid.uuid4().hex[:24]}",
            email=user.email,
            user_id=user.id,
            invited_at=datetime.utcnow(),
            email_sent_at=None,
            invited_by_user_id=invited_by_user_id,
        )
        self.invitations_repo.create(invitation)

        # 3. Send the welcome email (best-effort).
        email_sent = False
        try:
            await self.email_sender.send(
                to=user.email,
                subject="Tu acceso a Susurra (beta privada)",
                html=self._build_html(user.email, password),
                text=self._build_text(user.email, password),
                from_email=self.from_email,
            )
            self.invitations_repo.mark_email_sent(invitation.id)
            email_sent = True
        except Exception as e:  # noqa: BLE001 — best-effort
            logger.warning(
                "[InviteBetaUser] Resend failed for %s — invitation %s kept "
                "with email_sent_at=NULL: %s",
                user.email,
                invitation.id,
                e,
            )

        return InviteBetaUserResult(
            invitation_id=invitation.id,
            user_id=user.id,
            email=user.email,
            email_sent=email_sent,
        )

    def _build_html(self, email: str, password: str) -> str:
        return (
            "<h2>Bienvenido a Susurra</h2>"
            "<p>Tu acceso a la beta privada está listo.</p>"
            f"<p><strong>Email:</strong> {email}<br>"
            f"<strong>Contraseña:</strong> <code>{password}</code></p>"
            f'<p>Iniciá sesión en <a href="{self.sign_in_url}">'
            f"{self.sign_in_url}</a>.</p>"
            "<p>Importante: cambiá la contraseña en tu primera sesión si "
            "querés algo memorable. La generada es segura pero larga.</p>"
            "<hr>"
            '<p style="color: #888; font-size: 12px;">'
            "Susurra — el copilot íntimo para devs LATAM en interviews técnicas."
            "</p>"
        )

    def _build_text(self, email: str, password: str) -> str:
        return (
            "Bienvenido a Susurra\n\n"
            "Tu acceso a la beta privada está listo.\n\n"
            f"Email: {email}\n"
            f"Contraseña: {password}\n\n"
            f"Iniciá sesión en {self.sign_in_url}\n\n"
            "Importante: cambiá la contraseña en tu primera sesión si querés "
            "algo memorable.\n\n"
            "—\nSusurra\n"
        )
