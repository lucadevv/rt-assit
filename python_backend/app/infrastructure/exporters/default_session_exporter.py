"""Default session exporter (B2) — Markdown + PDF (reportlab).

Markdown: simple, readable layout with header, summary, action items,
speakers, tags, and the full transcript with speaker labels.

PDF: assembled with reportlab's high-level Platypus flowables. Uses the
default Helvetica family so we don't need to ship custom fonts inside
the slim Docker image. Spanish diacritics are encoded by reportlab as
WinAnsi/CP1252 by default."""
from __future__ import annotations

import io
from datetime import datetime
from typing import Optional

from app.application.ports.session_exporter import (
    SessionExportData,
    SessionExporter,
)
from app.domain.entities.persisted_transcript import PersistedTranscript
from app.domain.entities.speaker import Speaker


class DefaultSessionExporter(SessionExporter):
    """Renders a session aggregate to Markdown or PDF.

    Stateless — safe to share as a module-level singleton."""

    # --- Markdown -----------------------------------------------------

    def to_markdown(self, data: SessionExportData) -> str:
        s = data.session
        title = s.title or f"Sesión {s.id}"
        lines: list[str] = []
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"- **Escenario**: {s.scenario}")
        lines.append(f"- **ID de sesión**: `{s.id}`")
        lines.append(f"- **Idioma propio**: {s.my_language}")
        lines.append(f"- **Idioma del otro**: {s.other_language}")
        lines.append(f"- **Inicio**: {_fmt_dt(s.started_at)}")
        if s.ended_at is not None:
            lines.append(f"- **Fin**: {_fmt_dt(s.ended_at)}")
        if s.duration_seconds is not None:
            lines.append(f"- **Duración**: {_fmt_duration(s.duration_seconds)}")
        if data.tags:
            lines.append(f"- **Tags**: {', '.join(data.tags)}")
        lines.append("")

        lines.append("## Resumen")
        lines.append("")
        if s.summary:
            lines.append(s.summary)
        else:
            lines.append("_Resumen no disponible todavía._")
        lines.append("")

        lines.append("## Action items")
        lines.append("")
        if s.action_items:
            for item in s.action_items:
                lines.append(f"- [ ] {item}")
        else:
            lines.append("_Sin action items._")
        lines.append("")

        if data.speakers:
            lines.append("## Hablantes")
            lines.append("")
            for sp in data.speakers:
                lines.append(f"- {_speaker_display(sp)}")
            lines.append("")

        lines.append("## Conversación")
        lines.append("")
        if not data.transcripts:
            lines.append("_Sin transcripts._")
        else:
            speaker_map = _build_speaker_map(data.speakers)
            for t in data.transcripts:
                who = _resolve_speaker(t, speaker_map)
                ts = _fmt_ms(t.timestamp_ms)
                content = (t.content or "").strip()
                lines.append(f"**[{ts}] {who}**: {content}")
                lines.append("")

        if data.hints:
            lines.append("## Hints generados")
            lines.append("")
            for h in data.hints:
                ts = _fmt_ms(h.timestamp_ms)
                content = (h.content or "").strip()
                lines.append(f"- **[{ts}]** {content}")
            lines.append("")

        return "\n".join(lines).rstrip() + "\n"

    # --- PDF ----------------------------------------------------------

    def to_pdf(self, data: SessionExportData) -> bytes:
        # Imports are local so the application/ layer never sees reportlab.
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_LEFT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
        from reportlab.lib.units import cm
        from reportlab.platypus import (
            ListFlowable,
            ListItem,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
        )

        s = data.session
        title = s.title or f"Sesión {s.id}"

        styles = getSampleStyleSheet()
        h1 = ParagraphStyle(
            "AuriH1",
            parent=styles["Heading1"],
            fontSize=18,
            leading=22,
            spaceAfter=10,
            textColor=colors.HexColor("#1f2937"),
        )
        h2 = ParagraphStyle(
            "AuriH2",
            parent=styles["Heading2"],
            fontSize=13,
            leading=16,
            spaceBefore=10,
            spaceAfter=6,
            textColor=colors.HexColor("#0f172a"),
        )
        body = ParagraphStyle(
            "AuriBody",
            parent=styles["BodyText"],
            fontSize=10,
            leading=14,
            alignment=TA_LEFT,
            spaceAfter=4,
        )
        meta = ParagraphStyle(
            "AuriMeta",
            parent=body,
            textColor=colors.HexColor("#475569"),
            fontSize=9,
            leading=12,
        )
        speaker_style = ParagraphStyle(
            "AuriSpeaker",
            parent=body,
            fontName="Helvetica-Bold",
            spaceAfter=2,
        )

        buf = io.BytesIO()
        doc = SimpleDocTemplate(
            buf,
            pagesize=A4,
            leftMargin=2 * cm,
            rightMargin=2 * cm,
            topMargin=2 * cm,
            bottomMargin=2 * cm,
            title=title,
            author="Auri",
        )

        story: list[object] = []
        story.append(Paragraph(_pdf_escape(title), h1))

        # Metadata block
        meta_bits: list[str] = []
        meta_bits.append(f"<b>Escenario:</b> {_pdf_escape(s.scenario)}")
        meta_bits.append(f"<b>ID:</b> {_pdf_escape(s.id)}")
        meta_bits.append(
            f"<b>Idiomas:</b> {_pdf_escape(s.my_language)} / {_pdf_escape(s.other_language)}"
        )
        meta_bits.append(f"<b>Inicio:</b> {_pdf_escape(_fmt_dt(s.started_at))}")
        if s.ended_at is not None:
            meta_bits.append(f"<b>Fin:</b> {_pdf_escape(_fmt_dt(s.ended_at))}")
        if s.duration_seconds is not None:
            meta_bits.append(
                f"<b>Duración:</b> {_pdf_escape(_fmt_duration(s.duration_seconds))}"
            )
        if data.tags:
            meta_bits.append(
                f"<b>Tags:</b> {_pdf_escape(', '.join(data.tags))}"
            )
        story.append(Paragraph("<br/>".join(meta_bits), meta))
        story.append(Spacer(1, 0.4 * cm))

        # Summary
        story.append(Paragraph("Resumen", h2))
        story.append(
            Paragraph(
                _pdf_escape(s.summary or "Resumen no disponible todavía."),
                body,
            )
        )

        # Action items
        story.append(Paragraph("Action items", h2))
        if s.action_items:
            items = [
                ListItem(Paragraph(_pdf_escape(item), body))
                for item in s.action_items
            ]
            story.append(ListFlowable(items, bulletType="bullet", leftIndent=14))
        else:
            story.append(Paragraph(_pdf_escape("Sin action items."), body))

        # Speakers
        if data.speakers:
            story.append(Paragraph("Hablantes", h2))
            speaker_items = [
                ListItem(Paragraph(_pdf_escape(_speaker_display(sp)), body))
                for sp in data.speakers
            ]
            story.append(
                ListFlowable(speaker_items, bulletType="bullet", leftIndent=14)
            )

        # Conversation
        story.append(Paragraph("Conversación", h2))
        if not data.transcripts:
            story.append(Paragraph(_pdf_escape("Sin transcripts."), body))
        else:
            speaker_map = _build_speaker_map(data.speakers)
            for t in data.transcripts:
                who = _resolve_speaker(t, speaker_map)
                ts = _fmt_ms(t.timestamp_ms)
                story.append(
                    Paragraph(
                        f"[{_pdf_escape(ts)}] {_pdf_escape(who)}",
                        speaker_style,
                    )
                )
                story.append(
                    Paragraph(_pdf_escape((t.content or "").strip()), body)
                )
                story.append(Spacer(1, 0.15 * cm))

        # Hints
        if data.hints:
            story.append(Paragraph("Hints generados", h2))
            for h in data.hints:
                ts = _fmt_ms(h.timestamp_ms)
                story.append(
                    Paragraph(
                        f"<b>[{_pdf_escape(ts)}]</b> {_pdf_escape((h.content or '').strip())}",
                        body,
                    )
                )

        doc.build(story)
        return buf.getvalue()


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _build_speaker_map(speakers: list[Speaker]) -> dict[int, str]:
    out: dict[int, str] = {}
    for sp in speakers:
        out[sp.deepgram_speaker_id] = sp.label or f"Hablante {sp.deepgram_speaker_id + 1}"
    return out


def _resolve_speaker(
    t: PersistedTranscript, speaker_map: dict[int, str]
) -> str:
    if t.deepgram_speaker is None:
        return "Desconocido"
    return speaker_map.get(t.deepgram_speaker, f"Hablante {t.deepgram_speaker + 1}")


def _speaker_display(sp: Speaker) -> str:
    label = sp.label or f"Hablante {sp.deepgram_speaker_id + 1}"
    suffix = " (vos)" if sp.is_user else ""
    return f"{label}{suffix} — id deepgram {sp.deepgram_speaker_id}"


def _fmt_dt(dt: Optional[datetime]) -> str:
    if dt is None:
        return ""
    try:
        return dt.strftime("%Y-%m-%d %H:%M:%S UTC")
    except Exception:
        return str(dt)


def _fmt_duration(seconds: int) -> str:
    seconds = max(0, int(seconds))
    minutes, sec = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours}h {minutes:02d}m {sec:02d}s"
    if minutes:
        return f"{minutes}m {sec:02d}s"
    return f"{sec}s"


def _fmt_ms(ms: int) -> str:
    seconds = max(0, int(ms)) // 1000
    minutes, sec = divmod(seconds, 60)
    hours, minutes = divmod(minutes, 60)
    if hours:
        return f"{hours:02d}:{minutes:02d}:{sec:02d}"
    return f"{minutes:02d}:{sec:02d}"


_PDF_ESCAPES = (("&", "&amp;"), ("<", "&lt;"), (">", "&gt;"))


def _pdf_escape(text: object) -> str:
    """Escape XML metacharacters for reportlab Paragraph parser.

    reportlab's Paragraph treats text as mini-HTML, so unescaped ``<``
    or ``&`` will raise. Order matters — replace ``&`` first."""
    s = "" if text is None else str(text)
    for raw, esc in _PDF_ESCAPES:
        s = s.replace(raw, esc)
    return s
