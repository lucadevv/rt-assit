"""Generate a Spanish summary + action items for a finished session (B2).

Runs against the LLMProvider port via ``complete()`` (non-streaming). The
prompt is built in Spanish and asks for a strict JSON object — if the
model deviates (some open models do), we degrade gracefully: take the raw
text as the summary and leave action_items empty.

Multi-tenant: the session is fetched scoped to ``user_id`` so a leaked or
guessed UUID can't trigger an LLM call against another tenant."""
from __future__ import annotations

import json
import logging
import re
from typing import Optional

from app.application.ports.llm_provider import LLMProvider
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.speakers_repository import SpeakersRepository
from app.application.ports.transcripts_repository import TranscriptsRepository
from app.domain.entities.chat_message import ChatMessage
from app.domain.entities.session import Session
from app.domain.exceptions import NotFoundError


logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = (
    "Sos un asistente que resume conversaciones de trabajo en español rioplatense.\n"
    "Generá un resumen breve (2-3 oraciones) y una lista de action items "
    "(entre 3 y 5 ítems concretos y accionables).\n"
    "Formato de respuesta OBLIGATORIO (JSON estricto, sin markdown, sin texto extra):\n"
    "{\n"
    '  "summary": "...",\n'
    '  "action_items": ["...", "...", "..."]\n'
    "}"
)


_MAX_TRANSCRIPT_CHARS = 12000  # keep prompts modest; truncate oldest first


class GenerateSessionSummaryUseCase:
    """Builds a summary + action items from a session's final transcripts.

    Idempotent re-runs are allowed (regenerate-summary endpoint). Returns the
    updated ``Session`` after writing summary + action_items via the
    sessions repo."""

    def __init__(
        self,
        sessions_repo: SessionsRepository,
        transcripts_repo: TranscriptsRepository,
        speakers_repo: SpeakersRepository,
        llm: LLMProvider,
    ) -> None:
        self.sessions = sessions_repo
        self.transcripts = transcripts_repo
        self.speakers = speakers_repo
        self.llm = llm

    async def execute(self, *, session_id: str, user_id: str) -> Session:
        session = self.sessions.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        transcripts = self.transcripts.get_for_session(
            session_id=session_id, only_final=True
        )
        speakers = self.speakers.list_for_session(session_id)

        if not transcripts:
            # Nothing to summarise; still update so callers see "ran but empty".
            return self.sessions.update(
                session_id=session_id,
                user_id=user_id,
                summary="Sin transcript disponible para resumir.",
                action_items=[],
            )

        speaker_map: dict[int, str] = {}
        for s in speakers:
            label = s.label or f"Hablante {s.deepgram_speaker_id + 1}"
            speaker_map[s.deepgram_speaker_id] = label

        lines: list[str] = []
        for t in transcripts:
            who = "Desconocido"
            if t.deepgram_speaker is not None:
                who = speaker_map.get(t.deepgram_speaker, f"Hablante {t.deepgram_speaker + 1}")
            lines.append(f"[{who}] {t.content.strip()}")
        formatted = "\n".join(lines)
        if len(formatted) > _MAX_TRANSCRIPT_CHARS:
            # Keep the most recent context; older context is least relevant for action items.
            formatted = "...\n" + formatted[-_MAX_TRANSCRIPT_CHARS:]

        user_msg = (
            f"Conversación (escenario: {session.scenario}):\n\n"
            f"{formatted}\n\n"
            "Generá el resumen y los action items en JSON estricto."
        )

        try:
            response = await self.llm.complete(
                messages=[ChatMessage(role="user", content=user_msg)],
                system=_SYSTEM_PROMPT,
                max_tokens=600,
            )
        except Exception as e:  # pragma: no cover — provider error
            logger.exception("[B2] LLM complete() failed for session %s: %s", session_id, e)
            raise

        summary, action_items = _parse_llm_response(response)

        return self.sessions.update(
            session_id=session_id,
            user_id=user_id,
            summary=summary,
            action_items=action_items,
        )


_JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}")


def _parse_llm_response(raw: str) -> tuple[str, list[str]]:
    """Best-effort JSON parse. Falls back to raw-text-as-summary."""
    text = (raw or "").strip()
    if not text:
        return ("", [])

    candidates: list[str] = [text]
    match = _JSON_BLOCK_RE.search(text)
    if match:
        candidates.append(match.group(0))

    for candidate in candidates:
        try:
            parsed = json.loads(candidate)
        except (json.JSONDecodeError, ValueError):
            continue
        if not isinstance(parsed, dict):
            continue
        summary = str(parsed.get("summary", "") or "").strip()
        items_raw = parsed.get("action_items") or []
        action_items: list[str] = []
        if isinstance(items_raw, list):
            for item in items_raw:
                if not isinstance(item, str):
                    continue
                cleaned = item.strip()
                if cleaned:
                    action_items.append(cleaned)
        return (summary, action_items)

    # Fallback: treat the full reply as a summary.
    return (text[:500], [])


__all__ = ["GenerateSessionSummaryUseCase"]
