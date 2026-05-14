"""Subscription domain entity (B5 — Billing).

Status state machine:
  incomplete -> trialing -> active -> past_due -> canceled -> expired
                                              \-> paused
"""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

SubscriptionStatus = Literal[
    "incomplete",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "expired",
    "paused",
]

VALID_SUBSCRIPTION_STATUSES: set[str] = {
    "incomplete",
    "trialing",
    "active",
    "past_due",
    "canceled",
    "expired",
    "paused",
}


@dataclass
class Subscription:
    """A user's subscription record. One active subscription per user.

    All times are UTC ISO 8601 (NFR-22). Money fields live on related
    Invoice rows, NOT here, except the ``discount_cents`` carried forward
    from a promo code. ``cancel_at_period_end=True`` keeps the user in the
    plan until ``current_period_end`` (NFR-17 — no auto-refunds)."""

    id: str
    user_id: str
    plan_id: str
    status: SubscriptionStatus
    lemon_squeezy_subscription_id: Optional[str]
    lemon_squeezy_customer_id: Optional[str]
    current_period_start: Optional[datetime]
    current_period_end: Optional[datetime]
    trial_start: Optional[datetime]
    trial_end: Optional[datetime]
    cancel_at_period_end: bool
    canceled_at: Optional[datetime]
    payment_failed_at: Optional[datetime]
    grace_period_end: Optional[datetime]
    dunning_email_count: int
    default_payment_method_id: Optional[str]
    promo_code_applied: Optional[str]
    discount_cents: int
    pending_plan_id: Optional[str]
    created_at: datetime
    updated_at: datetime
