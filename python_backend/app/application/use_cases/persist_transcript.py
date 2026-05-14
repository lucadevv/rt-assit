"""Persist a transcript line into the active session.

Called from the WS pipeline (ProcessTranscriptUseCase) when a transcript
arrives. Auto-registers the speaker if a deepgram_speaker is supplied."""
from typing import Optional

from app.application.ports.speakers_repository import SpeakersRepository
from app.application.ports.transcripts_repository import TranscriptsRepository
from app.domain.entities.persisted_transcript import PersistedTranscript


class PersistTranscriptUseCase:
    def __init__(
        self,
        transcripts_repo: TranscriptsRepository,
        speakers_repo: SpeakersRepository,
    ) -> None:
        self.transcripts = transcripts_repo
        self.speakers = speakers_repo

    def execute(
        self,
        *,
        session_id: str,
        content: str,
        is_final: bool,
        timestamp_ms: int,
        deepgram_speaker: Optional[int] = None,
        language: Optional[str] = None,
        confidence: Optional[float] = None,
    ) -> PersistedTranscript:
        speaker_id: Optional[int] = None
        if deepgram_speaker is not None:
            speaker = self.speakers.get_or_create(
                session_id=session_id,
                deepgram_speaker_id=deepgram_speaker,
            )
            speaker_id = speaker.id

        return self.transcripts.append(
            session_id=session_id,
            content=content,
            is_final=is_final,
            timestamp_ms=timestamp_ms,
            speaker_id=speaker_id,
            deepgram_speaker=deepgram_speaker,
            language=language,
            confidence=confidence,
        )
