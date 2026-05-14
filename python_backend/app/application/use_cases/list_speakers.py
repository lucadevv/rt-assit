"""List speakers for a session (B3)."""
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.speakers_repository import SpeakersRepository
from app.domain.entities.session import Session
from app.domain.entities.speaker import Speaker
from app.domain.exceptions import NotFoundError


class ListSpeakersUseCase:
    """List speakers registered for a session (multi-tenant safe)."""

    def __init__(
        self,
        sessions_repo: SessionsRepository,
        speakers_repo: SpeakersRepository,
    ) -> None:
        self.sessions = sessions_repo
        self.speakers = speakers_repo

    def execute(
        self, *, session_id: str, user_id: str
    ) -> tuple[Session, list[Speaker]]:
        """Returns (session, speakers). The session is returned so the
        caller (presentation layer) can derive the scenario color hint
        without an extra DB round-trip."""
        session = self.sessions.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")
        speakers = self.speakers.list_for_session(session_id)
        return session, speakers
