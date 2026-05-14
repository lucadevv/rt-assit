"""Helpers for computing billing periods (UTC calendar months).

Pure function module — no I/O, no dependencies. Lives in services/ because
multiple use cases share these helpers (trial start, usage tracking, monthly
reset cron)."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone


def utcnow() -> datetime:
    """A naive UTC datetime — matches what we read back from SQLite (no tz)."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def current_month_period(now: datetime | None = None) -> tuple[datetime, datetime]:
    """Return ``(period_start, period_end)`` for the calendar month containing ``now``.

    period_start = 1st of month at 00:00:00 UTC.
    period_end   = 1st of NEXT month at 00:00:00 UTC (exclusive end)."""
    n = now or utcnow()
    period_start = datetime(n.year, n.month, 1)
    if n.month == 12:
        period_end = datetime(n.year + 1, 1, 1)
    else:
        period_end = datetime(n.year, n.month + 1, 1)
    return period_start, period_end


def add_days(dt: datetime, days: int) -> datetime:
    return dt + timedelta(days=days)
