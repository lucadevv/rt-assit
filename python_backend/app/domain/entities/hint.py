"""Hint domain entity (B1).

A hint is a generated assistant response associated with a session and
optionally linked to the transcript that triggered it."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Hint:
    id: int
    session_id: str
    related_transcript_id: Optional[int]
    content: str
    timestamp_ms: int
