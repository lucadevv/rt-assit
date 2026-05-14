"""Persist a generated hint into the active session.

Called from GenerateResponseUseCase / ProcessTranscriptUseCase after the
LLM stream completes."""
from typing import Optional

from app.application.ports.hints_repository import HintsRepository
from app.domain.entities.hint import Hint


class PersistHintUseCase:
    def __init__(self, repo: HintsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        session_id: str,
        content: str,
        timestamp_ms: int,
        related_transcript_id: Optional[int] = None,
    ) -> Hint:
        return self.repo.append(
            session_id=session_id,
            content=content,
            timestamp_ms=timestamp_ms,
            related_transcript_id=related_transcript_id,
        )
