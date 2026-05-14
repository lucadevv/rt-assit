"""Repository port for transcript-correction audit log (B2)."""
from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.transcript_correction import TranscriptCorrection


class TranscriptCorrectionsRepository(ABC):
    """Append-only audit log of transcript edits.

    Every row preserves the BEFORE/AFTER content of a single edit. Rows
    must never be deleted or mutated — corrections accumulate as history."""

    @abstractmethod
    def add(
        self,
        *,
        transcript_id: int,
        user_id: str,
        original_content: str,
        corrected_content: str,
        correction_reason: Optional[str],
    ) -> TranscriptCorrection:
        """Insert a new audit row. Returns the row with its assigned id."""
        ...

    @abstractmethod
    def list_for_transcript(
        self, transcript_id: int
    ) -> list[TranscriptCorrection]:
        """Ordered by created_at ASC."""
        ...
