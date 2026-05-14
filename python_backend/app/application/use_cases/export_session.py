"""Render a full session as a downloadable PDF or Markdown file (B2).

The use case loads the full ``SessionExportData`` aggregate (session +
transcripts + hints + speakers + tags) and delegates rendering to a
``SessionExporter`` adapter. Returns ``(content_bytes, mimetype)`` so the
HTTP router can stream the response with the right ``Content-Type``."""
from typing import Literal

from app.application.ports.hints_repository import HintsRepository
from app.application.ports.session_exporter import (
    SessionExportData,
    SessionExporter,
)
from app.application.ports.session_tags_repository import SessionTagsRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.speakers_repository import SpeakersRepository
from app.application.ports.transcripts_repository import TranscriptsRepository
from app.domain.exceptions import NotFoundError, ValidationError


ExportFormat = Literal["pdf", "md"]


class ExportSessionUseCase:
    def __init__(
        self,
        sessions_repo: SessionsRepository,
        transcripts_repo: TranscriptsRepository,
        hints_repo: HintsRepository,
        speakers_repo: SpeakersRepository,
        tags_repo: SessionTagsRepository,
        exporter: SessionExporter,
    ) -> None:
        self.sessions = sessions_repo
        self.transcripts = transcripts_repo
        self.hints = hints_repo
        self.speakers = speakers_repo
        self.tags = tags_repo
        self.exporter = exporter

    def execute(
        self,
        *,
        session_id: str,
        user_id: str,
        format: str,
    ) -> tuple[bytes, str]:
        fmt = (format or "").strip().lower()
        if fmt not in ("pdf", "md"):
            raise ValidationError(
                f"formato no soportado: {format!r} (use 'pdf' o 'md')"
            )

        session = self.sessions.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        data = SessionExportData(
            session=session,
            transcripts=self.transcripts.get_for_session(
                session_id=session_id, only_final=True
            ),
            hints=self.hints.get_for_session(session_id),
            speakers=self.speakers.list_for_session(session_id),
            tags=self.tags.list_tags(session_id),
        )

        if fmt == "md":
            return (self.exporter.to_markdown(data).encode("utf-8"), "text/markdown")
        return (self.exporter.to_pdf(data), "application/pdf")
