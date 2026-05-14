"""SQLite implementation of PlansRepository."""
from __future__ import annotations

import sqlite3
from typing import Optional, cast

from app.application.ports.plans_repository import PlansRepository
from app.domain.entities.plan import BillingCycle, Plan, PlanCode
from app.infrastructure.persistence.sqlite._billing_helpers import loads_json
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLitePlansRepository(PlansRepository):
    def list_active(self) -> list[Plan]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM plans
                   WHERE is_active = 1 AND is_legacy = 0
                   ORDER BY sort_order ASC"""
            ).fetchall()
        return [self._row(r) for r in rows]

    def list_all(self) -> list[Plan]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM plans ORDER BY sort_order ASC"
            ).fetchall()
        return [self._row(r) for r in rows]

    def get_by_id(self, plan_id: str) -> Optional[Plan]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM plans WHERE id = ?", (plan_id,)
            ).fetchone()
        return self._row(row) if row else None

    def get_by_code(
        self, code: str, billing_cycle: str = "monthly"
    ) -> Optional[Plan]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM plans
                   WHERE code = ? AND billing_cycle = ?
                     AND is_active = 1 AND is_legacy = 0
                   ORDER BY sort_order ASC LIMIT 1""",
                (code, billing_cycle),
            ).fetchone()
        return self._row(row) if row else None

    def get_by_lemon_squeezy_variant(self, variant_id: str) -> Optional[Plan]:
        if not variant_id:
            return None
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM plans
                   WHERE lemon_squeezy_variant_id = ?
                   ORDER BY sort_order ASC LIMIT 1""",
                (variant_id,),
            ).fetchone()
        return self._row(row) if row else None

    @staticmethod
    def _row(row: sqlite3.Row) -> Plan:
        return Plan(
            id=row["id"],
            code=cast(PlanCode, row["code"]),
            name=row["name"],
            description=row["description"],
            price_cents=int(row["price_cents"] or 0),
            currency=row["currency"] or "USD",
            billing_cycle=cast(BillingCycle, row["billing_cycle"]),
            lemon_squeezy_variant_id=row["lemon_squeezy_variant_id"],
            lemon_squeezy_product_id=row["lemon_squeezy_product_id"],
            limits=loads_json(row["limits"], {}),
            is_active=bool(row["is_active"]),
            is_legacy=bool(row["is_legacy"]),
            sort_order=int(row["sort_order"] or 0),
        )
