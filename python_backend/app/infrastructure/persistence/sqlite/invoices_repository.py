"""SQLite implementation of InvoicesRepository."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional, cast

from app.application.ports.invoices_repository import InvoicesRepository
from app.domain.entities.invoice import Invoice, InvoiceStatus
from app.infrastructure.persistence.sqlite._billing_helpers import (
    fmt_dt,
    parse_dt,
    parse_dt_required,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteInvoicesRepository(InvoicesRepository):
    def list_for_user(
        self, user_id: str, *, limit: int = 20, offset: int = 0
    ) -> list[Invoice]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM invoices WHERE user_id = ?
                   ORDER BY datetime(issued_at) DESC LIMIT ? OFFSET ?""",
                (user_id, limit, offset),
            ).fetchall()
        return [self._row(r) for r in rows]

    def get(self, invoice_id: str, user_id: str) -> Optional[Invoice]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM invoices WHERE id = ? AND user_id = ?",
                (invoice_id, user_id),
            ).fetchone()
        return self._row(row) if row else None

    def get_by_lemon_squeezy_id(
        self, lemon_squeezy_invoice_id: str
    ) -> Optional[Invoice]:
        if not lemon_squeezy_invoice_id:
            return None
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM invoices WHERE lemon_squeezy_invoice_id = ?",
                (lemon_squeezy_invoice_id,),
            ).fetchone()
        return self._row(row) if row else None

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
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO invoices
                   (id, user_id, subscription_id, lemon_squeezy_invoice_id,
                    invoice_number, subtotal_cents, discount_cents,
                    tax_cents, tax_rate, total_cents, currency, status,
                    period_start, period_end, issued_at, paid_at, invoice_pdf_url)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    invoice_id,
                    user_id,
                    subscription_id,
                    lemon_squeezy_invoice_id,
                    invoice_number,
                    subtotal_cents,
                    discount_cents,
                    tax_cents,
                    tax_rate,
                    total_cents,
                    currency,
                    status,
                    fmt_dt(period_start),
                    fmt_dt(period_end),
                    fmt_dt(issued_at) or fmt_dt(datetime.utcnow()),
                    fmt_dt(paid_at),
                    invoice_pdf_url,
                ),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM invoices WHERE id = ?", (invoice_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError("invoice insert failed")
        return self._row(row)

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
        fields = ["status = ?"]
        params: list[object] = [status]
        if paid_at is not None:
            fields.append("paid_at = ?")
            params.append(fmt_dt(paid_at))
        if refunded_at is not None:
            fields.append("refunded_at = ?")
            params.append(fmt_dt(refunded_at))
        if refund_amount_cents is not None:
            fields.append("refund_amount_cents = ?")
            params.append(refund_amount_cents)
        if refund_reason is not None:
            fields.append("refund_reason = ?")
            params.append(refund_reason)
        params.append(invoice_id)
        with get_conn() as conn:
            conn.execute(
                f"UPDATE invoices SET {', '.join(fields)} WHERE id = ?",
                params,
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM invoices WHERE id = ?", (invoice_id,)
            ).fetchone()
        return self._row(row) if row else None

    @staticmethod
    def _row(row: sqlite3.Row) -> Invoice:
        return Invoice(
            id=row["id"],
            user_id=row["user_id"],
            subscription_id=row["subscription_id"],
            lemon_squeezy_invoice_id=row["lemon_squeezy_invoice_id"],
            invoice_number=row["invoice_number"],
            subtotal_cents=int(row["subtotal_cents"] or 0),
            discount_cents=int(row["discount_cents"] or 0),
            tax_cents=int(row["tax_cents"] or 0),
            tax_rate=float(row["tax_rate"] or 0),
            total_cents=int(row["total_cents"] or 0),
            currency=row["currency"] or "USD",
            status=cast(InvoiceStatus, row["status"]),
            period_start=parse_dt(row["period_start"]),
            period_end=parse_dt(row["period_end"]),
            issued_at=parse_dt_required(row["issued_at"]),
            paid_at=parse_dt(row["paid_at"]),
            refunded_at=parse_dt(row["refunded_at"]),
            invoice_pdf_url=row["invoice_pdf_url"],
            refund_amount_cents=int(row["refund_amount_cents"] or 0),
            refund_reason=row["refund_reason"],
        )
