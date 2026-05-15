"""Create a new live session (B1)."""
import uuid
from typing import Any, Optional

from app.application.ports.meetings_repository import MeetingsRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session import Session, SessionMode
from app.domain.exceptions import ValidationError


class CreateSessionUseCase:
    def __init__(
        self,
        repo: SessionsRepository,
        meetings_repo: Optional[MeetingsRepository] = None,
    ) -> None:
        """``meetings_repo`` is optional so the legacy DI wiring (tests,
        callers that don't surface meetings) keeps working unchanged. When
        provided AND ``meeting_id`` is set on ``execute()``, we verify
        ownership against the same ``user_id`` before persisting the FK.
        """
        self.repo = repo
        self.meetings_repo = meetings_repo

    def execute(
        self,
        *,
        user_id: str,
        scenario: str,
        my_language: str,
        other_language: str,
        is_recording: bool,
        title: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
        mode: SessionMode = "agent",
        meeting_id: Optional[str] = None,
    ) -> Session:
        scenario = (scenario or "").strip()
        if not scenario:
            raise ValidationError("scenario es requerido")
        my_language = (my_language or "").strip()
        if not my_language:
            raise ValidationError("my_language es requerido")
        other_language = (other_language or "").strip()
        if not other_language:
            raise ValidationError("other_language es requerido")
        # Defensive validation — Pydantic already restricts the literal
        # at the API boundary, but tests / internal callers might pass
        # arbitrary strings. Reject anything off the contract instead
        # of silently falling back, since the wrong mode silently
        # changes user-visible behaviour.
        if mode not in ("agent", "scribe"):
            raise ValidationError(
                f"mode inválido: {mode!r} (esperado 'agent' o 'scribe')"
            )

        # Sprint 1.5 — verify the meeting (if any) belongs to the same user
        # before persisting the FK. We treat unknown / cross-user ids as a
        # validation error rather than silently dropping the link, so the
        # frontend gets a clear signal when it tries to attach a meeting it
        # shouldn't have access to.
        resolved_meeting_id: Optional[str] = None
        if meeting_id is not None and meeting_id.strip():
            mid = meeting_id.strip()
            if self.meetings_repo is None:
                # Repo not wired (tests / legacy DI): be permissive — old
                # behaviour created sessions without a meeting at all, so
                # silently drop the link rather than 500-ing the request.
                resolved_meeting_id = None
            else:
                meeting = self.meetings_repo.get(mid)
                if meeting is None:
                    raise ValidationError(
                        f"meeting_id inválido: {mid!r} (no existe)"
                    )
                if meeting.user_id != user_id:
                    raise ValidationError(
                        "meeting_id no pertenece al usuario"
                    )
                resolved_meeting_id = mid

        session_id = str(uuid.uuid4())
        return self.repo.create(
            session_id=session_id,
            user_id=user_id,
            scenario=scenario,
            my_language=my_language,
            other_language=other_language,
            is_recording=is_recording,
            title=title,
            metadata=metadata,
            mode=mode,
            meeting_id=resolved_meeting_id,
        )
