"""Plan domain entity (B5 — Billing).

Pure data — no framework or infrastructure dependencies. ``limits`` is a free-form
dict so we can evolve tier perks (max minutes, max docs, feature flags) without
schema changes. ``price_cents`` is integer cents per NFR-22 (no floating point).
"""
from dataclasses import dataclass, field
from typing import Any, Literal, Optional

PlanCode = Literal["free", "pro", "premium", "byok"]
BillingCycle = Literal["free", "monthly", "yearly", "lifetime"]

VALID_PLAN_CODES: set[str] = {"free", "pro", "premium", "byok"}
VALID_BILLING_CYCLES: set[str] = {"free", "monthly", "yearly", "lifetime"}


@dataclass
class Plan:
    """A plan in the catalog (free/pro_monthly/pro_yearly/etc.).

    Plans are seeded via ``seed_plans`` on init_db; the table acts as a
    catalog so pricing changes don't require a deploy. ``is_legacy`` flags
    plans that are no longer offered to new users but still honored for
    existing subscribers (grandfathering — NFR-11/NFR-14)."""

    id: str
    code: PlanCode
    name: str
    description: Optional[str]
    price_cents: int
    currency: str
    billing_cycle: BillingCycle
    lemon_squeezy_variant_id: Optional[str]
    lemon_squeezy_product_id: Optional[str]
    limits: dict[str, Any] = field(default_factory=dict)
    is_active: bool = True
    is_legacy: bool = False
    sort_order: int = 0
