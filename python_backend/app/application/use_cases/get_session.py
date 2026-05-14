"""Get a session with its full payload (transcripts + hints + speakers)."""
from dataclasses import dataclass

from app.application.ports.hints_repository import HintsRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.session_tags_repository import SessionTagsRepository
from app.application.ports.speakers_repository import SpeakersRepository
from app.application.ports.transcripts_repository import TranscriptsRepository
from app.domain.entities.hint import Hint
from app.domain.entities.persisted_transcript import PersistedTranscript
from app.domain.entities.session import Session
from app.domain.entities.speaker import Speaker
from app.domain.exceptions import NotFoundError


@dataclass
class SessionDetail:
    """Aggregate returned by GetSessionUseCase — session + child rows."""

    session: Session
    transcripts: list[PersistedTranscript]
    hints: list[Hint]
    speakers: list[Speaker]
    tags: list[str]


class GetSessionUseCase:
    def __init__(
        self,
        sessions_repo: SessionsRepository,
        transcripts_repo: TranscriptsRepository,
        hints_repo: HintsRepository,
        speakers_repo: SpeakersRepository,
        tags_repo: SessionTagsRepository,
    ) -> None:
        self.sessions = sessions_repo
        self.transcripts = transcripts_repo
        self.hints = hints_repo
        self.speakers = speakers_repo
        self.tags = tags_repo

    def execute(self, *, session_id: str, user_id: str) -> SessionDetail:
        session = self.sessions.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        return SessionDetail(
            session=session,
            transcripts=self.transcripts.get_for_session(session_id=session_id),
            hints=self.hints.get_for_session(session_id),
            speakers=self.speakers.list_for_session(session_id),
            tags=self.tags.list_tags(session_id),
        )
