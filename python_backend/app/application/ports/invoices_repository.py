"""Repository port for invoices (B5 — Billing)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from datetime import datetime
from typing import Optional

from app.domain.entities.invoice import Invoice, InvoiceStatus


class InvoicesRepository(ABC):
    @abstractmethod
    def list_for_user(
        self, user_id: str, *, limit: int = 20, offset: int = 0
    ) -> list[Invoice]:
        ...

    @abstractmethod
    def get(self, invoice_id: str, user_id: str) -> Optional[Invoice]:
        ...

    @abstractmethod
    def get_by_lemon_squeezy_id(
        self, lemon_squeezy_invoice_id: str
    ) -> Optional[Invoice]:
        ...

    @abstractmethod
    def create(
        self,
        *,
        invoice_id: str,
        user_id: str,
        subscription_id: Optional[str],
        lemon_squeezy_invoice_id: Optional[str],
        invoice_number: Optional[str],
        subtotal_cents: int,
        discount_cents: int,
        tax_cents: int,
        tax_rate: float,
        total_cents: int,
        currency: str,
        status: InvoiceStatus,
        period_start: Optional[datetime],
        period_end: Optional[datetime],
        issued_at: datetime,
        paid_at: Optional[datetime] = None,
        invoice_pdf_url: Optional[str] = None,
    ) -> Invoice:
        ...

    @abstractmethod
    def update_status(
        self,
        invoice_id: str,
        *,
        status: InvoiceStatus,
        paid_at: Optional[datetime] = None,
        refunded_at: Optional[datetime] = None,
        refund_amount_cents: Optional[int] = None,
        refund_reason: Optional[str] = None,
    ) -> Optional[Invoice]:
        ...
