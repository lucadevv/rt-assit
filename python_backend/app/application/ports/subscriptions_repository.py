"""Repository port for subscriptions (B5 — Billing)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from app.domain.entities.subscription import Subscription, SubscriptionStatus


class SubscriptionsRepository(ABC):
    """Subscriptions store. One active row per user is the invariant."""

    @abstractmethod
    def get(self, subscription_id: str) -> Optional[Subscription]:
        ...

    @abstractmethod
    def get_active_for_user(self, user_id: str) -> Optional[Subscription]:
        """Most recent non-expired subscription for the user."""
        ...

    @abstractmethod
    def get_by_lemon_squeezy_id(
        self, lemon_squeezy_subscription_id: str
    ) -> Optional[Subscription]:
        ...

    @abstractmethod
    def create(
        self,
        *,
        subscription_id: str,
        user_id: str,
        plan_id: str,
        status: SubscriptionStatus,
        lemon_squeezy_subscription_id: Optional[str] = None,
        lemon_squeezy_customer_id: Optional[str] = None,
        current_period_start: Optional[datetime] = None,
        current_period_end: Optional[datetime] = None,
        trial_start: Optional[datetime] = None,
        trial_end: Optional[datetime] = None,
        promo_code_applied: Optional[str] = None,
        discount_cents: int = 0,
    ) -> Subscription:
        ...

    @abstractmethod
    def update_status(
        self,
        subscription_id: str,
        *,
        status: SubscriptionStatus,
        canceled_at: Optional[datetime] = None,
        cancel_at_period_end: Optional[bool] = None,
        payment_failed_at: Optional[datetime] = None,
        grace_period_end: Optional[datetime] = None,
    ) -> Optional[Subscription]:
        ...

    @abstractmethod
    def update_period(
        self,
        subscription_id: str,
        *,
        current_period_start: datetime,
        current_period_end: datetime,
    ) -> Optional[Subscription]:
        ...

    @abstractmethod
    def update_plan(
        self,
        subscription_id: str,
        *,
        plan_id: Optional[str] = None,
        pending_plan_id: Optional[str] = None,
    ) -> Optional[Subscription]:
        ...

    @abstractmethod
    def increment_dunning(self, subscription_id: str) -> int:
        """Atomic +1 to dunning_email_count. Returns new count."""
        ...

    @abstractmethod
    def list_trials_expiring_before(
        self, cutoff: datetime
    ) -> list[Subscription]:
        """All trialing subscriptions with trial_end <= cutoff (cron support)."""
        ...

    @abstractmethod
    def list_past_due(self) -> list[Subscription]:
        """All past_due subscriptions for dunning email cron."""
        ...
