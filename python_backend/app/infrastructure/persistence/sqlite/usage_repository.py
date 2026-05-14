"""SQLite implementation of UsageRepository.

Atomic increments use the SQLite UPSERT pattern so the row is created if it
doesn't exist, then incremented. NFR-24 — concurrency safe."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional

from app.application.ports.usage_repository import UsageRepository
from app.domain.entities.usage_record import UsageRecord
from app.infrastructure.persistence.sqlite._billing_helpers import (
    dumps_json,
    fmt_dt,
    loads_json,
    parse_dt_required,
)
from app.infrastructure.persistence.sqlite.db import get_conn


VALID_FIELDS = {
    "minutes_used",
    "sessions_count",
    "sessions_completed",
    "docs_count",
    "storage_bytes_used",
    "share_links_created",
    "llm_input_tokens",
    "llm_output_tokens",
    "stt_audio_seconds",
    "cost_cents",
}


class SQLiteUsageRepository(UsageRepository):
    def get_for_period(
        self, user_id: str, period_start: datetime
    ) -> Optional[UsageRecord]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT * FROM usage_records
                   WHERE user_id = ? AND period_start = ?""",
                (user_id, fmt_dt(period_start)),
            ).fetchone()
        return self._row(row) if row else None

    def get_or_create_for_period(
        self, user_id: str, period_start: datetime, period_end: datetime
    ) -> UsageRecord:
        with get_conn() as conn:
            conn.execute(
                """INSERT OR IGNORE INTO usage_records
                   (user_id, period_start, period_end)
                   VALUES (?, ?, ?)""",
                (user_id, fmt_dt(period_start), fmt_dt(period_end)),
            )
            conn.commit()
            row = conn.execute(
                """SELECT * FROM usage_records
                   WHERE user_id = ? AND period_start = ?""",
                (user_id, fmt_dt(period_start)),
            ).fetchone()
        if row is None:
            raise RuntimeError("usage_records get_or_create failed")
        return self._row(row)

    def atomic_increment(
        self,
        *,
        user_id: str,
        period_start: datetime,
        period_end: datetime,
        field: str,
        delta: int,
    ) -> UsageRecord:
        if field not in VALID_FIELDS:
            raise ValueError(f"invalid usage field: {field}")
        with get_conn() as conn:
            # Upsert: insert empty row if missing, then increment.
            conn.execute(
                """INSERT OR IGNORE INTO usage_records
                   (user_id, period_start, period_end)
                   VALUES (?, ?, ?)""",
                (user_id, fmt_dt(period_start), fmt_dt(period_end)),
            )
            # Field name is whitelisted via VALID_FIELDS, safe to interpolate.
            conn.execute(
                f"""UPDATE usage_records
                    SET {field} = {field} + ?
                    WHERE user_id = ? AND period_start = ?""",
                (delta, user_id, fmt_dt(period_start)),
            )
            conn.commit()
            row = conn.execute(
                """SELECT * FROM usage_records
                   WHERE user_id = ? AND period_start = ?""",
                (user_id, fmt_dt(period_start)),
            ).fetchone()
        if row is None:
            raise RuntimeError("usage_records increment failed")
        return self._row(row)

    def list_history_for_user(
        self, user_id: str, *, months: int = 12
    ) -> list[UsageRecord]:
        with get_conn() as conn:
            rows = conn.execute(
                """SELECT * FROM usage_records
                   WHERE user_id = ?
                   ORDER BY datetime(period_start) DESC LIMIT ?""",
                (user_id, months),
            ).fetchall()
        return [self._row(r) for r in rows]

    def reset_all_for_period(self, period_start: datetime) -> int:
        # Pre-create empty rows for every active user so first request of
        # the new period doesn't hit a cold path.
        from datetime import datetime as _dt

        ps = fmt_dt(period_start)
        # period_end = first of next month.
        if period_start.month == 12:
            period_end = _dt(period_start.year + 1, 1, 1)
        else:
            period_end = _dt(period_start.year, period_start.month + 1, 1)
        pe = fmt_dt(period_end)

        with get_conn() as conn:
            users = conn.execute("SELECT id FROM users").fetchall()
            count = 0
            for u in users:
                cur = conn.execute(
                    """INSERT OR IGNORE INTO usage_records
                       (user_id, period_start, period_end)
                       VALUES (?, ?, ?)""",
                    (u["id"], ps, pe),
                )
                count += cur.rowcount
            conn.commit()
        return count

    @staticmethod
    def _row(row: sqlite3.Row) -> UsageRecord:
        return UsageRecord(
            user_id=row["user_id"],
            period_start=parse_dt_required(row["period_start"]),
            period_end=parse_dt_required(row["period_end"]),
            minutes_used=int(row["minutes_used"] or 0),
            sessions_count=int(row["sessions_count"] or 0),
            sessions_completed=int(row["sessions_completed"] or 0),
            docs_count=int(row["docs_count"] or 0),
            storage_bytes_used=int(row["storage_bytes_used"] or 0),
            share_links_created=int(row["share_links_created"] or 0),
            llm_input_tokens=int(row["llm_input_tokens"] or 0),
            llm_output_tokens=int(row["llm_output_tokens"] or 0),
            stt_audio_seconds=int(row["stt_audio_seconds"] or 0),
            cost_cents=int(row["cost_cents"] or 0),
            limit_hits=loads_json(row["limit_hits"], {}),
        )

    @staticmethod
    def _dumps(value):  # pragma: no cover — convenience for callers
        return dumps_json(value)
