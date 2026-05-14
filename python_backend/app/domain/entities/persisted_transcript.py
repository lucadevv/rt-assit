"""Persisted transcript domain entity (B1).

Distinct from ``IncomingTranscript`` (live data shape from rt_go on the wire).
This entity represents a transcript row stored against a Session."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class PersistedTranscript:
    """A transcript line associated with a session.

    ``speaker_id`` references ``Speaker.id`` once a speaker row has been
    registered; ``deepgram_speaker`` is the raw 0/1/2 cluster id from
    Deepgram, kept for re-mapping after rename."""

    id: int
    session_id: str
    speaker_id: Optional[int]
    deepgram_speaker: Optional[int]
    content: str
    is_final: bool
    timestamp_ms: int
    language: Optional[str]
    confidence: Optional[float]
