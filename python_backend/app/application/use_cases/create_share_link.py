"""CreateShareLinkUseCase (B7 — Premium share links).

Creates a public-access link for a session. Tier-gated (Pro+ unlocked,
Pro capped at 10/month, Premium unlimited). Pure business logic — no
framework imports."""
from __future__ import annotations

import logging
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.share_links_repository import ShareLinksRepository
from app.application.ports.usage_repository import UsageRepository
from app.application.services.billing_periods import current_month_period
from app.application.use_cases.check_tier_limits import (
    CheckTierLimitsUseCase,
    IsShareLinksAvailableUseCase,
)
from app.domain.entities.share_link import ShareLink
from app.domain.exceptions import (
    NotFoundError,
    UpgradeRequiredError,
    ValidationError,
)


logger = logging.getLogger(__name__)


_VALID_PERMISSIONS = ("transcript_only", "with_audio", "edit")


def _utcnow_naive() -> datetime:
    """Naive UTC — matches what we read back from SQLite."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _generate_short_id() -> str:
    """12-char URL-safe short id (~71 bits of entropy).

    ``secrets.token_urlsafe(9)`` returns 12 base64url-encoded chars from
    9 random bytes; we slice to 12 defensively in case future Python
    changes the encoding length."""
    return secrets.token_urlsafe(9)[:12]


class CreateShareLinkUseCase:
    """Generate a share link for a session.

    Pre-conditions:
    - Session exists and is owned by ``user_id``
    - User's plan unlocks share links (Pro+)
    - User has not exceeded ``max_share_links`` quota for the period

    Post-conditions:
    - ShareLink row inserted with a fresh 12-char short id
    - ``share_links_created`` usage counter incremented (best-effort)"""

    def __init__(
        self,
        *,
        share_repo: ShareLinksRepository,
        sessions_repo: SessionsRepository,
        is_share_available: IsShareLinksAvailableUseCase,
        check_tier_limits: CheckTierLimitsUseCase,
        usage_repo: UsageRepository,
    ) -> None:
        self.share_repo = share_repo
        self.sessions_repo = sessions_repo
        self.is_share_available = is_share_available
        self.check_tier_limits = check_tier_limits
        self.usage_repo = usage_repo

    def execute(
        self,
        *,
        session_id: str,
        user_id: str,
        permissions: str,
        expires_in_hours: Optional[int] = None,
    ) -> ShareLink:
        # Validate permissions whitelist FIRST (cheaper than DB lookup).
        if permissions not in _VALID_PERMISSIONS:
            raise ValidationError(
                f"Permiso inválido: {permissions}. "
                f"Usá uno de: {', '.join(_VALID_PERMISSIONS)}"
            )

        # Validate expiration window if provided.
        if expires_in_hours is not None and expires_in_hours <= 0:
            raise ValidationError(
                "expires_in_hours debe ser mayor a 0 o nulo"
            )

        # Multi-tenant ownership check.
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"Sesión {session_id} no encontrada")

        # Tier gate: feature unlocked at all?
        if not self.is_share_available.execute(user_id=user_id):
            raise UpgradeRequiredError(
                "Compartir sesiones requiere plan Premium",
                limit="max_share_links",
                current_tier="free",
                required_tier="premium",
            )

        # Quota enforcement (Pro tier capped at 10/period; Premium unlimited).
        # ``check_tier_limits.execute`` reads ``share_links_created`` from the
        # current UsageRecord and raises UpgradeRequiredError if cap+1 exceeds.
        self.check_tier_limits.execute(
            user_id=user_id,
            limit="max_share_links",
            increment=1,
        )

        # Compute expiration (None = never auto-expire).
        expires_at: Optional[datetime] = None
        if expires_in_hours:
            expires_at = _utcnow_naive() + timedelta(hours=expires_in_hours)

        link = ShareLink(
            id=_generate_short_id(),
            session_id=session_id,
            user_id=user_id,
            permissions=permissions,  # type: ignore[arg-type]
            expires_at=expires_at,
            revoked_at=None,
            view_count=0,
            created_at=_utcnow_naive(),
        )
        created = self.share_repo.create(link)

        # Best-effort usage counter increment so quota tracking stays in sync.
        # Failure must not block the user (counter drift is acceptable).
        try:
            period_start, period_end = current_month_period()
            self.usage_repo.atomic_increment(
                user_id=user_id,
                period_start=period_start,
                period_end=period_end,
                field="share_links_created",
                delta=1,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[CreateShareLink] usage increment failed for {user_id}: {e}"
            )

        return created
