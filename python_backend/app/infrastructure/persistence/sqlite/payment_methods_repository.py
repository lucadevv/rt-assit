"""SQLite implementation of PaymentMethodsRepository."""
from __future__ import annotations

import sqlite3
from typing import Optional, cast

from app.application.ports.payment_methods_repository import (
    PaymentMethodsRepository,
)
from app.domain.entities.payment_method import PaymentMethod, PaymentMethodType
from app.infrastructure.persistence.sqlite._billing_helpers import (
    parse_dt_required,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLitePaymentMethodsRepository(PaymentMethodsRepository):
    def list_for_user(self, user_id: str) -> list[PaymentMethod]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM payment_methods
                   WHERE user_id = ? AND is_active = 1
                   ORDER BY is_default DESC, created_at DESC""",
                (user_id,),
            ).fetchall()
        return [self._row(r) for r in rows]

    def get_default_for_user(
        self, user_id: str
    ) -> Optional[PaymentMethod]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM payment_methods
                   WHERE user_id = ? AND is_default = 1 AND is_active = 1
                   LIMIT 1""",
                (user_id,),
            ).fetchone()
        return self._row(row) if row else None

    def upsert_from_provider(
        self,
        *,
        payment_method_id: str,
        user_id: str,
        lemon_squeezy_payment_method_id: Optional[str],
        type: str,
        brand: Optional[str],
        last_four: Optional[str],
        exp_month: Optional[int],
        exp_year: Optional[int],
        is_default: bool,
    ) -> PaymentMethod:
        with get_conn() as conn:
            if is_default:
                conn.execute(
                    "UPDATE payment_methods SET is_default = 0 WHERE user_id = ?",
                    (user_id,),
                )
            conn.execute(
                """INSERT INTO payment_methods
                   (id, user_id, lemon_squeezy_payment_method_id,
                    type, brand, last_four, exp_month, exp_year,
                    is_default, is_active)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
                   ON CONFLICT(id) DO UPDATE SET
                       lemon_squeezy_payment_method_id = excluded.lemon_squeezy_payment_method_id,
                       type = excluded.type,
                       brand = excluded.brand,
                       last_four = excluded.last_four,
                       exp_month = excluded.exp_month,
                       exp_year = excluded.exp_year,
                       is_default = excluded.is_default,
                       is_active = 1""",
                (
                    payment_method_id,
                    user_id,
                    lemon_squeezy_payment_method_id,
                    type,
                    brand,
                    last_four,
                    exp_month,
                    exp_year,
                    1 if is_default else 0,
                ),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM payment_methods WHERE id = ?",
                (payment_method_id,),
            ).fetchone()
        if row is None:
            raise RuntimeError("payment_method upsert failed")
        return self._row(row)

    @staticmethod
    def _row(row: sqlite3.Row) -> PaymentMethod:
        return PaymentMethod(
            id=row["id"],
            user_id=row["user_id"],
            lemon_squeezy_payment_method_id=row["lemon_squeezy_payment_method_id"],
            type=cast(PaymentMethodType, row["type"] or "card"),
            brand=row["brand"],
            last_four=row["last_four"],
            exp_month=row["exp_month"],
            exp_year=row["exp_year"],
            is_default=bool(row["is_default"]),
            is_active=bool(row["is_active"]),
            created_at=parse_dt_required(row["created_at"]),
        )
