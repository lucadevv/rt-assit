"""Incoming transcript entity (rt_go forwards these via WS)."""
from dataclasses import dataclass


@dataclass
class IncomingTranscript:
    content: str
    is_final: bool
    is_speculative: bool
    speaker: int = 0
    ms: int = 0
