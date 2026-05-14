"""Merge multiple deepgram_speaker_ids under the same label (B3).

Deepgram diarization sometimes splits the same physical speaker into two
cluster ids (different mic distance, momentary silence, voice change).
This use case lets the user assign one label to multiple ids in a single
operation — effectively a "merge" from the UX point of view.

We don't physically merge rows (transcripts keep their original
``deepgram_speaker`` so we don't lose audit) — we just unify the label.
"""
from app.application.ports.session_event_publisher import SessionEventPublisher
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.speakers_repository import SpeakersRepository
from app.domain.entities.speaker import Speaker
from app.domain.exceptions import NotFoundError, ValidationError


class MergeSpeakersUseCase:
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
        label: str,
        deepgram_speaker_ids: list[int],
    ) -> list[Speaker]:
        # Auth: only the owner of the session can merge speakers.
        session = self.sessions.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        if not deepgram_speaker_ids:
            raise ValidationError(
                "Necesitás al menos un deepgram_speaker_id para hacer merge"
            )
        if not label or not label.strip():
            raise ValidationError("El label no puede estar vacío")

        normalized_label = label.strip()
        merged: list[Speaker] = []
        for dsid in deepgram_speaker_ids:
            sp = self.speakers.upsert_label(
                session_id=session_id,
                deepgram_speaker_id=int(dsid),
                label=normalized_label,
            )
            merged.append(sp)

        await self.publisher.publish_to_session(
            session_id,
            {
                "type": "speakers_merged",
                "session_id": session_id,
                "label": normalized_label,
                "deepgram_speaker_ids": [int(d) for d in deepgram_speaker_ids],
                "speakers": [
                    {
                        "id": s.id,
                        "deepgram_speaker_id": s.deepgram_speaker_id,
                        "label": s.label,
                        "is_user": s.is_user,
                    }
                    for s in merged
                ],
            },
        )

        return merged
