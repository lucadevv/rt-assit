"""User-driven speaker label edit (B1 + B3).

B3 changes:
- Async to allow broadcasting the WS event after the DB write.
- Upserts the speaker row instead of failing on missing — a user may
  pre-label a speaker before they've actually spoken (Deepgram hasn't
  emitted that cluster yet).
- Broadcasts ``speaker_label_updated`` to all WS clients of the session.
"""
from typing import Optional

from app.application.ports.session_event_publisher import SessionEventPublisher
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.speakers_repository import SpeakersRepository
from app.domain.entities.speaker import Speaker
from app.domain.exceptions import NotFoundError


class RenameSpeakerUseCase:
    def __init__(
        self,
        sessions_repo: SessionsRepository,
        speakers_repo: SpeakersRepository,
        event_publisher: SessionEventPublisher,
    ) -> None:
        self.sessions = sessions_repo
        self.speakers = speakers_repo
        self.publisher = event_publisher

    async def execute(
        self,
        *,
        session_id: str,
        user_id: str,
        deepgram_speaker_id: int,
        label: Optional[str],
    ) -> Speaker:
        # Auth check: confirm the session belongs to the user before mutating.
        session = self.sessions.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        # Upsert: if the deepgram speaker id hasn't been seen yet, the row
        # is created; otherwise only the label is updated. Idempotent.
        speaker = self.speakers.upsert_label(
            session_id=session_id,
            deepgram_speaker_id=deepgram_speaker_id,
            label=label,
        )

        # B3 — live multi-tab sync. Best effort: publisher MUST swallow per
        # client errors so a broken socket cannot fail the rename.
        await self.publisher.publish_to_session(
            session_id,
            {
                "type": "speaker_label_updated",
                "session_id": session_id,
                "speaker": {
                    "id": speaker.id,
                    "deepgram_speaker_id": speaker.deepgram_speaker_id,
                    "label": speaker.label,
                    "is_user": speaker.is_user,
                },
            },
        )

        return speaker
