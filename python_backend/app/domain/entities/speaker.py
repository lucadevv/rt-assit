"""Speaker domain entity (B1).

A speaker registered for a session. Auto-created on first encounter of a
``deepgram_speaker_id``; user can rename via the rename endpoint."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class Speaker:
    id: int
    session_id: str
    deepgram_speaker_id: int
    label: Optional[str]
    is_user: bool
