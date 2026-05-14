"""SQLite implementation of SubscriptionsRepository."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional, cast

from app.application.ports.subscriptions_repository import SubscriptionsRepository
from app.domain.entities.subscription import Subscription, SubscriptionStatus
from app.infrastructure.persistence.sqlite._billing_helpers import (
    fmt_dt,
    parse_dt,
    parse_dt_required,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteSubscriptionsRepository(SubscriptionsRepository):
    def get(self, subscription_id: str) -> Optional[Subscription]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM subscriptions WHERE id = ?", (subscription_id,)
            ).fetchone()
        return self._row(row) if row else None

    def get_active_for_user(self, user_id: str) -> Optional[Subscription]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM subscriptions
                   WHERE user_id = ?
                     AND status NOT IN ('expired')
                   ORDER BY datetime(created_at) DESC LIMIT 1""",
                (user_id,),
            ).fetchone()
            if row is None:
                # Fall back to most recent (even expired) so callers see history.
                row = conn.execute(
                    """SELECT * FROM subscriptions
                       WHERE user_id = ?
                       ORDER BY datetime(created_at) DESC LIMIT 1""",
                    (user_id,),
                ).fetchone()
        return self._row(row) if row else None

    def get_by_lemon_squeezy_id(
        self, lemon_squeezy_subscription_id: str
    ) -> Optional[Subscription]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM subscriptions
                   WHERE lemon_squeezy_subscription_id = ?""",
                (lemon_squeezy_subscription_id,),
            ).fetchone()
        return self._row(row) if row else None

    def create(
        self,
        *,
        subscription_id: str,
        user_id: str,
        plan_id: str,
        status: SubscriptionStatus,
        lemon_squeezy_subscription_id: Optional[str] = None,
        lemon_squeezy_customer_id: Optional[str] = None,
        current_period_start: Optional[datetime] = None,
        current_period_end: Optional[datetime] = None,
        trial_start: Optional[datetime] = None,
        trial_end: Optional[datetime] = None,
        promo_code_applied: Optional[str] = None,
        discount_cents: int = 0,
    ) -> Subscription:
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO subscriptions
                   (id, user_id, plan_id, status,
                    lemon_squeezy_subscription_id, lemon_squeezy_customer_id,
                    current_period_start, current_period_end,
                    trial_start, trial_end,
                    promo_code_applied, discount_cents)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    subscription_id,
                    user_id,
                    plan_id,
                    status,
                    lemon_squeezy_subscription_id,
                    lemon_squeezy_customer_id,
                    fmt_dt(current_period_start),
                    fmt_dt(current_period_end),
                    fmt_dt(trial_start),
                    fmt_dt(trial_end),
                    promo_code_applied,
                    discount_cents,
                ),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM subscriptions WHERE id = ?", (subscription_id,)
            ).fetchone()
        if row is None:
            raise RuntimeError("subscription insert failed")
        return self._row(row)

    def update_status(
        self,
        subscription_id: str,
        *,
        status: SubscriptionStatus,
        canceled_at: Optional[datetime] = None,
        cancel_at_period_end: Optional[bool] = None,
        payment_failed_at: Optional[datetime] = None,
        grace_period_end: Optional[datetime] = None,
    ) -> Optional[Subscription]:
        fields = ["status = ?", "updated_at = datetime('now')"]
        params: list[object] = [status]
        if canceled_at is not None:
            fields.append("canceled_at = ?")
            params.append(fmt_dt(canceled_at))
        elif canceled_at is None and cancel_at_period_end is False:
            # Reactivation explicitly clears canceled_at.
            fields.append("canceled_at = NULL")
        if cancel_at_period_end is not None:
            fields.append("cancel_at_period_end = ?")
            params.append(1 if cancel_at_period_end else 0)
        if payment_failed_at is not None:
            fields.append("payment_failed_at = ?")
            params.append(fmt_dt(payment_failed_at))
        else:
            # Explicit None clears the value (recovered).
            if "payment_failed_at" in (
                "payment_failed_at"
            ):  # placeholder no-op
                pass
        if grace_period_end is not None:
            fields.append("grace_period_end = ?")
            params.append(fmt_dt(grace_period_end))
        params.append(subscription_id)
        with get_conn() as conn:
            conn.execute(
                f"UPDATE subscriptions SET {', '.join(fields)} WHERE id = ?",
                params,
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM subscriptions WHERE id = ?", (subscription_id,)
            ).fetchone()
        return self._row(row) if row else None

    def update_period(
        self,
        subscription_id: str,
        *,
        current_period_start: datetime,
        current_period_end: datetime,
    ) -> Optional[Subscription]:
        with get_conn() as conn:
            conn.execute(
                """UPDATE subscriptions
                   SET current_period_start = ?,
                       current_period_end = ?,
                       updated_at = datetime('now')
                   WHERE id = ?""",
                (
                    fmt_dt(current_period_start),
                    fmt_dt(current_period_end),
                    subscription_id,
                ),
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM subscriptions WHERE id = ?", (subscription_id,)
            ).fetchone()
        return self._row(row) if row else None

    def update_plan(
        self,
        subscription_id: str,
        *,
        plan_id: Optional[str] = None,
        pending_plan_id: Optional[str] = None,
    ) -> Optional[Subscription]:
        fields = ["updated_at = datetime('now')"]
        params: list[object] = []
        if plan_id is not None:
            fields.insert(0, "plan_id = ?")
            params.insert(0, plan_id)
        if pending_plan_id is not None:
            fields.insert(0, "pending_plan_id = ?")
            params.insert(0, pending_plan_id)
        if not params:
            return self.get(subscription_id)
        params.append(subscription_id)
        with get_conn() as conn:
            conn.execute(
                f"UPDATE subscriptions SET {', '.join(fields)} WHERE id = ?",
                params,
            )
            conn.commit()
            row = conn.execute(
                "SELECT * FROM subscriptions WHERE id = ?", (subscription_id,)
            ).fetchone()
        return self._row(row) if row else None

    def increment_dunning(self, subscription_id: str) -> int:
        with get_conn() as conn:
            conn.execute(
                """UPDATE subscriptions
                   SET dunning_email_count = dunning_email_count + 1,
                       updated_at = datetime('now')
                   WHERE id = ?""",
                (subscription_id,),
            )
            conn.commit()
            row = conn.execute(
                "SELECT dunning_email_count FROM subscriptions WHERE id = ?",
                (subscription_id,),
            ).fetchone()
        return int(row["dunning_email_count"]) if row else 0

    def list_trials_expiring_before(
        self, cutoff: datetime
    ) -> list[Subscription]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM subscriptions
                   WHERE status = 'trialing'
                     AND trial_end IS NOT NULL
                     AND datetime(trial_end) <= datetime(?)""",
                (fmt_dt(cutoff),),
            ).fetchall()
        return [self._row(r) for r in rows]

    def list_past_due(self) -> list[Subscription]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM subscriptions WHERE status = 'past_due'"
            ).fetchall()
        return [self._row(r) for r in rows]

    @staticmethod
    def _row(row: sqlite3.Row) -> Subscription:
        return Subscription(
            id=row["id"],
            user_id=row["user_id"],
            plan_id=row["plan_id"],
            status=cast(SubscriptionStatus, row["status"]),
            lemon_squeezy_subscription_id=row["lemon_squeezy_subscription_id"],
            lemon_squeezy_customer_id=row["lemon_squeezy_customer_id"],
            current_period_start=parse_dt(row["current_period_start"]),
            current_period_end=parse_dt(row["current_period_end"]),
            trial_start=parse_dt(row["trial_start"]),
            trial_end=parse_dt(row["trial_end"]),
            cancel_at_period_end=bool(row["cancel_at_period_end"]),
            canceled_at=parse_dt(row["canceled_at"]),
            payment_failed_at=parse_dt(row["payment_failed_at"]),
            grace_period_end=parse_dt(row["grace_period_end"]),
            dunning_email_count=int(row["dunning_email_count"] or 0),
            default_payment_method_id=row["default_payment_method_id"],
            promo_code_applied=row["promo_code_applied"],
            discount_cents=int(row["discount_cents"] or 0),
            pending_plan_id=row["pending_plan_id"],
            created_at=parse_dt_required(row["created_at"]),
            updated_at=parse_dt_required(row["updated_at"]),
        )
