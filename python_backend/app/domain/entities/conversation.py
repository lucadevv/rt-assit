"""Conversation memory domain entities."""
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class Question:
    text: str
    timestamp: datetime = field(default_factory=datetime.now)


@dataclass
class Hint:
    text: str
    related_question: Optional[str] = None
    timestamp: datetime = field(default_factory=datetime.now)
