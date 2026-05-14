"""UsageRecord domain entity (B5 — Billing).

One row per (user_id, period_start) — period is the calendar month. Counters
support atomic increments at the SQL level (UPDATE col = col + ? WHERE ...).
``limit_hits`` is a dict keyed by limit name with the count of times the user
hit that ceiling during the period."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class UsageRecord:
    """Cumulative usage counters for a (user, month) pair."""

    user_id: str
    period_start: datetime
    period_end: datetime
    minutes_used: int = 0
    sessions_count: int = 0
    sessions_completed: int = 0
    docs_count: int = 0
    storage_bytes_used: int = 0
    share_links_created: int = 0
    llm_input_tokens: int = 0
    llm_output_tokens: int = 0
    stt_audio_seconds: int = 0
    cost_cents: int = 0
    limit_hits: dict[str, Any] = field(default_factory=dict)
