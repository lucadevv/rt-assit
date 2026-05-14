"""Create a new live session (B1)."""
import uuid
from typing import Any, Optional

from app.application.ports.sessions_repository import SessionsRepository
from app.domain.entities.session import Session, SessionMode
from app.domain.exceptions import ValidationError


class CreateSessionUseCase:
    def __init__(self, repo: SessionsRepository) -> None:
        self.repo = repo

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
        )
