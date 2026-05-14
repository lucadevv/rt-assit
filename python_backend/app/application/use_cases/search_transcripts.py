"""FTS5-backed search across a user's transcripts (B2).

Multi-tenant safe by design: the underlying repo JOINs through
``sessions`` to filter by ``user_id``. If the caller passes a
``session_id`` they don't own, the use case returns an empty list rather
than leaking 404 vs 403 ambiguity."""
from typing import Optional

from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.transcripts_repository import TranscriptsRepository
from app.domain.entities.persisted_transcript import PersistedTranscript


class SearchTranscriptsUseCase:
    def __init__(
        self,
        transcripts_repo: TranscriptsRepository,
        sessions_repo: SessionsRepository,
    ) -> None:
        self.transcripts = transcripts_repo
        self.sessions = sessions_repo

    def execute(
        self,
        *,
        user_id: str,
        query: str,
        session_id: Optional[str] = None,
        limit: int = 50,
    ) -> list[PersistedTranscript]:
        if not (query or "").strip():
            return []

        # Verify ownership when scoped to a single session — quietly hide
        # results otherwise instead of revealing existence via 403.
        if session_id is not None:
            session = self.sessions.get(session_id, user_id)
            if session is None:
                return []

        return self.transcripts.search_for_user(
            user_id=user_id,
            query=query,
            session_id=session_id,
            limit=max(1, min(int(limit), 200)),
        )
