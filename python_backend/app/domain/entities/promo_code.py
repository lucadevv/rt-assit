"""PromoCode + PromoCodeUse domain entities (B5 — Billing)."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Literal, Optional

DiscountType = Literal["percentage", "fixed_amount", "first_month_free"]

VALID_DISCOUNT_TYPES: set[str] = {"percentage", "fixed_amount", "first_month_free"}


@dataclass
class PromoCode:
    """A redeemable promo code applied to a subscription on checkout."""

    id: str
    code: str
    description: Optional[str]
    discount_type: DiscountType
    discount_value: int
    applicable_plans: list[str] = field(default_factory=list)
    max_uses: Optional[int] = None
    max_uses_per_user: int = 1
    valid_from: Optional[datetime] = None
    valid_until: Optional[datetime] = None
    is_active: bool = True
    times_redeemed: int = 0
    created_at: Optional[datetime] = None


@dataclass
class PromoCodeUse:
    """One redemption of a PromoCode by a user."""

    id: int
    promo_code_id: str
    user_id: str
    subscription_id: Optional[str]
    redeemed_at: datetime
