"""Edit a transcript line and persist an immutable audit record (B2).

Flow:
1. Look up the transcript by id (no user scoping at this step — the
   repo accepts any id and returns ``None`` if missing).
2. Verify the transcript's parent session belongs to ``user_id``. If
   not, raise ``UnauthorizedError`` (mapped to 403 by the router).
3. If the new content equals the existing content, no-op.
4. Otherwise, INSERT a ``TranscriptCorrection`` audit row with the
   BEFORE/AFTER text, then UPDATE the transcript content (the FTS5
   trigger keeps the index in sync automatically — see db.py)."""
from typing import Optional

from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.transcript_corrections_repository import (
    TranscriptCorrectionsRepository,
)
from app.application.ports.transcripts_repository import TranscriptsRepository
from app.domain.entities.persisted_transcript import PersistedTranscript
from app.domain.exceptions import (
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)


class EditTranscriptUseCase:
    def __init__(
        self,
        transcripts_repo: TranscriptsRepository,
        corrections_repo: TranscriptCorrectionsRepository,
        sessions_repo: SessionsRepository,
    ) -> None:
        self.transcripts = transcripts_repo
        self.corrections = corrections_repo
        self.sessions = sessions_repo

    def execute(
        self,
        *,
        transcript_id: int,
        user_id: str,
        new_content: str,
        reason: Optional[str] = None,
    ) -> PersistedTranscript:
        if not isinstance(new_content, str):
            raise ValidationError("contenido inválido")
        new_content = new_content.strip()
        if not new_content:
            raise ValidationError("el contenido no puede estar vacío")

        transcript = self.transcripts.get_by_id(transcript_id)
        if transcript is None:
            raise NotFoundError(f"transcript {transcript_id} no encontrado")

        session = self.sessions.get(transcript.session_id, user_id)
        if session is None:
            raise UnauthorizedError("no tenés acceso a este transcript")

        if new_content == transcript.content:
            return transcript

        self.corrections.add(
            transcript_id=transcript_id,
            user_id=user_id,
            original_content=transcript.content,
            corrected_content=new_content,
            correction_reason=reason,
        )

        return self.transcripts.update_content(transcript_id, new_content)
