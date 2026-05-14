"""TranscriptCorrection domain entity (B2).

Audit log row created every time a user edits a transcript line. The
original text is preserved verbatim — corrections never overwrite
history. Pure data — no framework or infrastructure dependencies."""
from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass
class TranscriptCorrection:
    """An immutable audit record for a single transcript edit.

    ``transcript_id`` references ``transcripts.id``. ``original_content``
    captures the text BEFORE the edit; ``corrected_content`` captures the
    text AFTER. Multi-tenant via ``user_id``."""

    id: int
    transcript_id: int
    user_id: str
    original_content: str
    corrected_content: str
    correction_reason: Optional[str]
    created_at: datetime
