"""CheckTierLimitsUseCase — invoked BEFORE actions to enforce free-tier caps.

Returns True if action is allowed, raises UpgradeRequiredError with limit + tier
info otherwise. Centralised here so callers don't reimplement free-tier rules.

Examples:
  CreateSession: check max_minutes_per_month + max_session_duration_minutes
  UploadDocument: check max_docs
  CreateRecording (B6): check max_recordings + max_storage_gb
  CreateShareLink (B7): check max_share_links

Server-side enforcement is mandatory (NFR-4)."""
from __future__ import annotations

import logging
from typing import Any, Literal, Optional

from app.application.ports.plans_repository import PlansRepository
from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.application.ports.usage_repository import UsageRepository
from app.application.services.billing_periods import current_month_period
from app.domain.exceptions import UpgradeRequiredError


logger = logging.getLogger(__name__)


LimitName = Literal[
    "max_session_duration_minutes",
    "max_minutes_per_month",
    "max_docs",
    "max_recordings",
    "max_storage_gb",
    "max_share_links",
    "max_custom_scenarios",
]


class CheckTierLimitsUseCase:
    """Authoritative server-side gate for tier limits (NFR-4)."""

    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        plans_repo: PlansRepository,
        usage_repo: UsageRepository,
    ) -> None:
        self.subs = subscriptions_repo
        self.plans = plans_repo
        self.usage = usage_repo

    def execute(
        self,
        *,
        user_id: str,
        limit: LimitName,
        current_value: Optional[int] = None,
        increment: int = 1,
    ) -> None:
        """Verify (current_value + increment) does not exceed the plan limit.

        ``current_value=None`` means: read the matching counter from the
        current period UsageRecord. For non-counter limits like
        ``max_session_duration_minutes`` callers MUST pass the value explicitly."""
        plan = self._resolve_plan(user_id)
        if plan is None:
            return  # No plan = no limits enforced (defensive default).

        cap = plan.limits.get(limit)
        # None / unset = unlimited
        if cap is None:
            return

        if current_value is None:
            current_value = self._read_counter(user_id, limit)

        if current_value + increment > cap:
            raise UpgradeRequiredError(
                f"Excediste el límite de {limit} de tu plan "
                f"({plan.name}). Pasá a Pro para continuar.",
                limit=limit,
                current_tier=plan.code,
                required_tier=self._suggest_upgrade_tier(plan.code),
            )

    def _resolve_plan(self, user_id: str):
        sub = self.subs.get_active_for_user(user_id)
        if sub is None:
            # No subscription → free plan. Defensive: read free plan from catalog.
            return self.plans.get_by_code("free", billing_cycle="free")
        return self.plans.get_by_id(sub.plan_id)

    def _read_counter(self, user_id: str, limit: str) -> int:
        period_start, period_end = current_month_period()
        record = self.usage.get_or_create_for_period(
            user_id, period_start, period_end
        )
        # Map limit -> counter field on UsageRecord.
        if limit == "max_minutes_per_month":
            return record.minutes_used
        if limit == "max_docs":
            return record.docs_count
        if limit == "max_share_links":
            return record.share_links_created
        # max_recordings / max_storage_gb / max_custom_scenarios are tracked
        # directly by their respective domains (recordings/scenarios), so the
        # caller MUST pass current_value for those limits.
        return 0

    @staticmethod
    def _suggest_upgrade_tier(current: str) -> str:
        return {
            "free": "pro",
            "pro": "premium",
            "byok": "premium",
            "premium": "premium",
        }.get(current, "pro")


class IsFeatureAvailableUseCase:
    """Boolean check for feature flags driven by plan limits.

    Examples: 'diarization_enabled', 'voice_fingerprinting_enabled',
    'stealth_mode', 'byok_enabled', 'priority_support'."""

    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        plans_repo: PlansRepository,
    ) -> None:
        self.subs = subscriptions_repo
        self.plans = plans_repo

    def execute(self, *, user_id: str, feature: str) -> bool:
        sub = self.subs.get_active_for_user(user_id)
        if sub is None:
            plan = self.plans.get_by_code("free", billing_cycle="free")
        else:
            plan = self.plans.get_by_id(sub.plan_id)
        if plan is None:
            return False
        value: Any = plan.limits.get(feature)
        if isinstance(value, bool):
            return value
        if isinstance(value, list):
            return bool(value)
        return False


class IsRecordingsAvailableUseCase:
    """B6 — Recordings feature gate.

    Driven by ``plan.limits['max_recordings']``:
      - ``None`` -> unlimited (Pro+ tiers) -> True
      - integer > 0 -> capped quota (still unlocked) -> True
      - ``0`` -> recordings disabled (Free tier) -> False
    """

    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        plans_repo: PlansRepository,
    ) -> None:
        self.subs = subscriptions_repo
        self.plans = plans_repo

    def execute(self, *, user_id: str) -> bool:
        sub = self.subs.get_active_for_user(user_id)
        if sub is None:
            plan = self.plans.get_by_code("free", billing_cycle="free")
        else:
            plan = self.plans.get_by_id(sub.plan_id)
        if plan is None:
            return False
        value = plan.limits.get("max_recordings", 0)
        # None = unlimited, anything truthy / nonzero numeric = unlocked.
        if value is None:
            return True
        try:
            return int(value) != 0
        except (TypeError, ValueError):
            return bool(value)


class IsShareLinksAvailableUseCase:
    """B7 — Share links feature gate.

    Driven by ``plan.limits['max_share_links']``:
      - ``None`` -> unlimited (Premium tier) -> True
      - integer > 0 -> capped quota per period (Pro tier) -> True
      - ``0`` -> share links disabled (Free tier) -> False

    Quota enforcement (capped tiers) is handled by ``CheckTierLimitsUseCase``
    against the ``share_links_created`` counter on UsageRecord; this gate only
    decides whether the feature is unlocked at all.
    """

    def __init__(
        self,
        *,
        subscriptions_repo: SubscriptionsRepository,
        plans_repo: PlansRepository,
    ) -> None:
        self.subs = subscriptions_repo
        self.plans = plans_repo

    def execute(self, *, user_id: str) -> bool:
        sub = self.subs.get_active_for_user(user_id)
        if sub is None:
            plan = self.plans.get_by_code("free", billing_cycle="free")
        else:
            plan = self.plans.get_by_id(sub.plan_id)
        if plan is None:
            return False
        value = plan.limits.get("max_share_links", 0)
        # None = unlimited, anything truthy / nonzero numeric = unlocked.
        if value is None:
            return True
        try:
            return int(value) != 0
        except (TypeError, ValueError):
            return bool(value)
