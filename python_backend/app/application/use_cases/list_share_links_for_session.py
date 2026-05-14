"""ListShareLinksForSessionUseCase (B7 — Premium share links).

Lists all share links for a session. Multi-tenant safety: verifies the
caller owns the session before returning rows."""
from __future__ import annotations

from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.share_links_repository import ShareLinksRepository
from app.domain.entities.share_link import ShareLink
from app.domain.exceptions import NotFoundError


class ListShareLinksForSessionUseCase:
    """List all (active + revoked) share links for a session, owner-scoped."""

    def __init__(
        self,
        *,
        share_repo: ShareLinksRepository,
        sessions_repo: SessionsRepository,
    ) -> None:
        self.share_repo = share_repo
        self.sessions_repo = sessions_repo

    def execute(self, *, session_id: str, user_id: str) -> list[ShareLink]:
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"Sesión {session_id} no encontrada")
        return self.share_repo.list_for_session(session_id, user_id)
