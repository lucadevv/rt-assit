"""Persona domain entity.

A persona is a named identity a user can switch between per session.
Each persona links to N documents — some flagged as identity (CV-like),
others as knowledge base (reference material).

Pure domain — no framework imports.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional


PersonaTone = Literal["professional", "casual", "formal"]


@dataclass
class Persona:
    id: int
    user_id: str
    name: str
    description: Optional[str]
    scenario_id: Optional[str]
    icon: Optional[str]
    tone: Optional[PersonaTone]
    custom_instructions: Optional[str]
    is_default: bool
    created_at: datetime
    updated_at: datetime
