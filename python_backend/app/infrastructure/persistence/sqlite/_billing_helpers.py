"""Shared helpers for B5 SQLite billing repositories."""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Optional


def parse_dt(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    normalised = value.replace("T", " ").replace("Z", "")
    try:
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        try:
            return datetime.fromisoformat(value)
        except ValueError:
            return None


def parse_dt_required(value: Optional[str]) -> datetime:
    parsed = parse_dt(value)
    if parsed is None:
        return datetime.utcnow()
    return parsed


def fmt_dt(value: Optional[datetime]) -> Optional[str]:
    if value is None:
        return None
    return value.strftime("%Y-%m-%d %H:%M:%S")


def loads_json(value: Optional[str], default: Any) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


def dumps_json(value: Any) -> str:
    return json.dumps(value or {})
