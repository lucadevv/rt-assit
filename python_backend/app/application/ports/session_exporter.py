"""Session exporter port (B2) — formats a full session into PDF or Markdown.

Single-impl today (`DefaultSessionExporter`), but kept as a port so swapping
the renderer (e.g. to weasyprint or to an HTML template engine) doesn't
require touching use cases or routers.

The exporter receives a fully-loaded ``SessionExportData`` aggregate; it
must be PURE — no DB lookups, no framework imports, no I/O beyond
returning bytes/str."""
from abc import ABC, abstractmethod
from dataclasses import dataclass, field

from app.domain.entities.hint import Hint
from app.domain.entities.persisted_transcript import PersistedTranscript
from app.domain.entities.session import Session
from app.domain.entities.speaker import Speaker


@dataclass
class SessionExportData:
    """Aggregate consumed by ``SessionExporter`` — everything needed to
    render one session in any format. Plain dataclass, no Pydantic."""

    session: Session
    transcripts: list[PersistedTranscript] = field(default_factory=list)
    hints: list[Hint] = field(default_factory=list)
    speakers: list[Speaker] = field(default_factory=list)
    tags: list[str] = field(default_factory=list)


class SessionExporter(ABC):
    """Renders a session aggregate to a portable file format."""

    @abstractmethod
    def to_markdown(self, data: SessionExportData) -> str:
        """Return UTF-8 markdown text."""
        ...

    @abstractmethod
    def to_pdf(self, data: SessionExportData) -> bytes:
        """Return raw PDF bytes."""
        ...
