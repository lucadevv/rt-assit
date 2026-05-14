"""SQLite implementation of PromoCodesRepository."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional, cast

from app.application.ports.promo_codes_repository import PromoCodesRepository
from app.domain.entities.promo_code import (
    DiscountType,
    PromoCode,
    PromoCodeUse,
)
from app.infrastructure.persistence.sqlite._billing_helpers import (
    fmt_dt,
    loads_json,
    parse_dt,
    parse_dt_required,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLitePromoCodesRepository(PromoCodesRepository):
    def get_by_code(self, code: str) -> Optional[PromoCode]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM promo_codes WHERE code = ?", (code,)
            ).fetchone()
        return self._row(row) if row else None

    def count_uses_by_user(
        self, promo_code_id: str, user_id: str
    ) -> int:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT COUNT(*) AS c FROM promo_code_uses
                   WHERE promo_code_id = ? AND user_id = ?""",
                (promo_code_id, user_id),
            ).fetchone()
        return int(row["c"] or 0) if row else 0

    def record_use(
        self,
        *,
        promo_code_id: str,
        user_id: str,
        subscription_id: Optional[str],
        redeemed_at: datetime,
    ) -> PromoCodeUse:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO promo_code_uses
                   (promo_code_id, user_id, subscription_id, redeemed_at)
                   VALUES (?, ?, ?, ?)""",
                (
                    promo_code_id,
                    user_id,
                    subscription_id,
                    fmt_dt(redeemed_at),
                ),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM promo_code_uses WHERE id = ?",
                (cur.lastrowid,),
            ).fetchone()
        if row is None:
            raise RuntimeError("promo_code_use insert failed")
        return PromoCodeUse(
            id=int(row["id"]),
            promo_code_id=row["promo_code_id"],
            user_id=row["user_id"],
            subscription_id=row["subscription_id"],
            redeemed_at=parse_dt_required(row["redeemed_at"]),
        )

    def increment_redemptions(self, promo_code_id: str) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE promo_codes
                   SET times_redeemed = times_redeemed + 1
                   WHERE id = ?""",
                (promo_code_id,),
            )
            conn.commit()

    @staticmethod
    def _row(row: sqlite3.Row) -> PromoCode:
        return PromoCode(
            id=row["id"],
            code=row["code"],
            description=row["description"],
            discount_type=cast(DiscountType, row["discount_type"]),
            discount_value=int(row["discount_value"] or 0),
            applicable_plans=loads_json(row["applicable_plans"], []),
            max_uses=row["max_uses"],
            max_uses_per_user=int(row["max_uses_per_user"] or 1),
            valid_from=parse_dt(row["valid_from"]),
            valid_until=parse_dt(row["valid_until"]),
            is_active=bool(row["is_active"]),
            times_redeemed=int(row["times_redeemed"] or 0),
            created_at=parse_dt(row["created_at"]),
        )
