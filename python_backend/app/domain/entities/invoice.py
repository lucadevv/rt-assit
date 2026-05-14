"""Invoice domain entity (B5 — Billing).

All amounts are integer cents (NFR-22). ``status`` reflects payment lifecycle.
Refunds flow via ``refund_amount_cents`` + ``refunded_at`` (partial OK)."""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

InvoiceStatus = Literal[
    "draft",
    "pending",
    "paid",
    "failed",
    "refunded",
    "partially_refunded",
]

VALID_INVOICE_STATUSES: set[str] = {
    "draft",
    "pending",
    "paid",
    "failed",
    "refunded",
    "partially_refunded",
}


@dataclass
class Invoice:
    """One invoice row per billing event (charge, refund, proration)."""

    id: str
    user_id: str
    subscription_id: Optional[str]
    lemon_squeezy_invoice_id: Optional[str]
    invoice_number: Optional[str]
    subtotal_cents: int
    discount_cents: int
    tax_cents: int
    tax_rate: float
    total_cents: int
    currency: str
    status: InvoiceStatus
    period_start: Optional[datetime]
    period_end: Optional[datetime]
    issued_at: datetime
    paid_at: Optional[datetime]
    refunded_at: Optional[datetime]
    invoice_pdf_url: Optional[str]
    refund_amount_cents: int
    refund_reason: Optional[str]
