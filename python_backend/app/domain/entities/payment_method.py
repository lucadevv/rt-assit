"""PaymentMethod domain entity (B5 — Billing).

PCI compliance (NFR-13): NEVER store PAN/CVV. Only Lemon Squeezy tokens +
display metadata (brand/last_four/exp). The actual card data lives in LS."""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

PaymentMethodType = Literal["card", "paypal", "other"]


@dataclass
class PaymentMethod:
    """A payment method stored as a token reference to Lemon Squeezy.

    NEVER includes raw card data — only display metadata."""

    id: str
    user_id: str
    lemon_squeezy_payment_method_id: Optional[str]
    type: PaymentMethodType
    brand: Optional[str]
    last_four: Optional[str]
    exp_month: Optional[int]
    exp_year: Optional[int]
    is_default: bool
    is_active: bool
    created_at: datetime
