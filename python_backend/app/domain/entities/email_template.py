"""EmailTemplate domain entity (B8 — cross-cutting).

DB-stored email templates. Replaces the B5-era hardcoded templates in
``infrastructure/email/templates.py`` so operators can update copy
without redeploying. Versioned + per-language with safe fallback."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class EmailTemplate:
    """A renderable transactional email template.

    ``id`` is a stable identifier used by the application layer
    (e.g. ``"welcome"``, ``"trial_expiring_24h"``). ``language`` is an
    ISO-like tag (``"es-419"``, ``"en-US"``). The renderer falls back to
    the default language when no exact match is found. Substitution uses
    ``{{var}}`` placeholders (kept simple — no Jinja dependency)."""

    id: str
    subject_template: str
    html_template: str
    text_template: str
    language: str = "es-419"
    is_active: bool = True
    version: int = 1
    updated_at: Optional[datetime] = None
