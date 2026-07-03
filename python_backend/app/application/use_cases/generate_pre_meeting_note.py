"""Generate AI-driven pre-interview prep (probing questions + checklist).

Pure generation step — does NOT persist. The router exposes this as
``POST /api/pre-meeting-notes/generate`` so the user can preview the
output BEFORE creating the session. Persistence happens in a separate
call after the session row exists.

The LLM is asked for a strict JSON object. If the model deviates (some
open models do), we degrade gracefully: empty arrays instead of raising,
so the UI can surface "no se pudo generar — probá de nuevo" without a
500.

Persona context (CV-equivalent identity docs) is folded into the prompt
when a ``persona_id`` is provided. The persona repo + documents repo
are used together because identity docs are linked via persona_documents
(is_identity=True), and the actual ``content`` lives on the Documents
table.
"""
from __future__ import annotations

import json
import logging
import re
from dataclasses import dataclass
from typing import Optional

from app.application.ports.documents_repository import DocumentsRepository
from app.application.ports.llm_provider import LLMProvider
from app.application.ports.personas_repository import PersonasRepository
from app.domain.entities.chat_message import ChatMessage


logger = logging.getLogger(__name__)


_SYSTEM_PROMPT = (
    "Sos un coach de carreras especializado en dev interviews para LATAM. "
    "Generás preparación previa concreta y accionable, sin clichés ni "
    "consejos genéricos. Respondés SIEMPRE con JSON estricto, sin "
    "markdown, sin texto adicional."
)


_JSON_BLOCK_RE = re.compile(r"\{[\s\S]*\}")


_MAX_QUESTIONS = 6
_MAX_CHECKLIST = 6
_MAX_CV_CHARS = 2000


@dataclass
class GeneratePreMeetingNoteUseCase:
    """Generates (probing_questions, prep_checklist) for an interview.

    Each list is capped at 6 items. Questions are produced in ENGLISH
    (since the interview itself is in English), checklist in es-LATAM
    (voseo, the user's prep language)."""

    llm: LLMProvider
    personas_repo: PersonasRepository
    documents_repo: DocumentsRepository

    async def execute(
        self,
        *,
        user_id: str,
        scenario_id: str,
        persona_id: Optional[int],
        role_target: str,
        company_context: str,
        job_description: Optional[str],
        raw_user_input: str,
    ) -> tuple[tuple[str, ...], tuple[str, ...]]:
        cv_summary = self._load_cv_summary(
            user_id=user_id, persona_id=persona_id
        )
        user_prompt = self._build_prompt(
            scenario_id=scenario_id,
            role_target=role_target,
            company_context=company_context,
            job_description=job_description,
            raw_user_input=raw_user_input,
            cv_summary=cv_summary,
        )

        try:
            response = await self.llm.complete(
                messages=[ChatMessage(role="user", content=user_prompt)],
                system=_SYSTEM_PROMPT,
                max_tokens=800,
            )
        except Exception as e:  # pragma: no cover — provider error
            logger.exception(
                "[pre-meeting] LLM complete() failed for user=%s: %s",
                user_id,
                e,
            )
            raise

        questions, checklist = _parse_llm_response(response)
        return questions[:_MAX_QUESTIONS], checklist[:_MAX_CHECKLIST]

    def _load_cv_summary(
        self, *, user_id: str, persona_id: Optional[int]
    ) -> str:
        if persona_id is None:
            return ""
        try:
            identity_ids = set(
                self.personas_repo.list_documents(
                    persona_id=persona_id,
                    user_id=user_id,
                    is_identity=True,
                )
            )
        except Exception:  # noqa: BLE001 — degrade gracefully
            return ""
        if not identity_ids:
            return ""

        chunks: list[str] = []
        remaining = _MAX_CV_CHARS
        for doc_id in list(identity_ids)[:3]:
            try:
                doc = self.documents_repo.get(doc_id, user_id)
            except Exception:  # noqa: BLE001
                continue
            if doc is None:
                continue
            snippet = (doc.content or "").strip()
            if not snippet:
                continue
            if len(snippet) > remaining:
                snippet = snippet[:remaining]
            chunks.append(f"# {doc.title}\n{snippet}")
            remaining -= len(snippet)
            if remaining <= 0:
                break
        return "\n\n".join(chunks)

    @staticmethod
    def _build_prompt(
        *,
        scenario_id: str,
        role_target: str,
        company_context: str,
        job_description: Optional[str],
        raw_user_input: str,
        cv_summary: str,
    ) -> str:
        scenario_label = (
            "técnica (coding / system design / tooling)"
            if scenario_id == "interview_dev"
            else "comportamental (behavioural / leadership / STAR)"
        )
        return f"""CONTEXTO DEL CANDIDATO:
{cv_summary or "No se proveyeron documentos de identidad. Inferí del input."}

CONTEXTO DEL INTERVIEW:
- Tipo: {scenario_id} ({scenario_label})
- Rol objetivo: {role_target}
- Empresa: {company_context}
- Job description: {job_description or "No fue provisto."}

LO QUE ESCRIBIÓ EL CANDIDATO:
{raw_user_input}

TAREA:
Generá un JSON con DOS arrays:

1. "probing_questions": 4-6 preguntas probables que le harán en esta entrevista.
   - EN INGLÉS (porque la entrevista será en inglés).
   - Específicas al rol, al stack, al CV y al job description (si fue provisto).
   - Concretas. NO genéricas tipo "Tell me about yourself".
   - Una pregunta por línea, sin numeración.

2. "prep_checklist": 4-6 bullets accionables en es-LATAM voseo (Argentina).
   - Cosas concretas para repasar o tener listas antes de la llamada.
   - Cuando aplique, usá voseo ("repasá", "preparate", "tenés", "podés").
   - Sin emojis. Sin claims grandilocuentes.

Respondé SOLO con JSON válido, sin markdown, sin backticks, sin texto adicional.
Formato exacto:
{{
  "probing_questions": ["...", "..."],
  "prep_checklist": ["...", "..."]
}}"""


def _parse_llm_response(raw: str) -> tuple[tuple[str, ...], tuple[str, ...]]:
    """Best-effort JSON parse. Returns ((), ()) if the model failed.

    Mirrors the shape used by ``generate_session_summary`` so the failure
    mode is consistent across LLM calls."""
    text = (raw or "").strip()
    if not text:
        return ((), ())

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
        questions = _coerce_str_list(parsed.get("probing_questions"))
        checklist = _coerce_str_list(parsed.get("prep_checklist"))
        return questions, checklist

    return ((), ())


def _coerce_str_list(raw: object) -> tuple[str, ...]:
    if not isinstance(raw, list):
        return ()
    out: list[str] = []
    for item in raw:
        if not isinstance(item, str):
            continue
        cleaned = item.strip()
        if cleaned:
            out.append(cleaned)
    return tuple(out)


__all__ = ["GeneratePreMeetingNoteUseCase"]
