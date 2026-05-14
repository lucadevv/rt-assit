"""Build the full system + user prompts dynamically from scenario + documents.

Application service — orchestrates domain entities (Scenario, Document) but
does not depend on infrastructure (no SQL, no FastAPI). Repos are injected
via ports so this stays testable in isolation.

Wave 1A note: Scenario system prompts now use 1st-person identity-assumption
placeholders. They are filled via simple string ``.replace()`` (NOT
``str.format``) so missing tokens degrade gracefully and Wave 2 can add more
without breaking older scenarios. The token contract is:

- ``{candidate_name}``   -> the user's display name (or generic fallback)
- ``{identity_docs}``    -> formatted CV / profile / linkedin / bio docs
- ``{scenario_docs}``    -> scenario-specific docs (job_offer, exam_syllabus, ...)
- ``{reference_docs}``   -> any extra "reference" docs

Legacy tokens kept for backward-compat:
- ``{candidate_context}`` -> alias of ``{identity_docs}``
- ``{scenario_context}``  -> alias of ``{scenario_docs}``
"""
import os
from typing import TYPE_CHECKING, Optional

from app.application.ports.documents_repository import DocumentsRepository
from app.application.ports.scenario_repository import ScenarioRepository
from app.application.ports.users_repository import UsersRepository
from app.domain.entities.document import Document
from app.domain.entities.session import SessionMode

if TYPE_CHECKING:
    # H2 — type-only imports keep the prompt builder importable when the
    # personas / session_materials infra hasn't been wired in DI yet (the
    # H1+H2 parallel rollout: H1 lands the SQLite repos + DI factories;
    # until then ``deps.py`` wires PromptBuilder with ``None`` for both
    # repos and the build path falls through to the legacy behavior).
    from app.application.ports.personas_repository import PersonasRepository
    from app.application.ports.session_materials_repository import (
        SessionMaterialsRepository,
    )
    from app.domain.entities.persona import Persona
    from app.domain.entities.session_material import SessionMaterial


# Doc types that describe the speaker's IDENTITY (who they ARE).
IDENTITY_DOC_TYPES: set[str] = {"cv", "profile", "linkedin", "bio"}
# Reference docs are bibliography / supporting material applicable to any scenario.
REFERENCE_DOC_TYPES: set[str] = {"reference"}
# Backward-compat alias.
CANDIDATE_DOC_TYPES: set[str] = IDENTITY_DOC_TYPES

PAST_QUESTIONS_WINDOW = 5
PAST_HINTS_WINDOW = 5

# Fail-loud placeholder shown when no real name is available (no CV uploaded,
# extractor didn't find a name, user hasn't set their profile name). Surfaces
# explicitly in the agent's output as "[nombre]" so the user notices the
# missing profile data and completes it. NEVER substitute a generic word like
# "el usuario" — that hides the gap from the end-user and the LLM.
DEFAULT_CANDIDATE_NAME = "[nombre — completá tu perfil con tu CV o nombre real]"


class PromptBuilder:
    """Assembles (system_prompt, user_prompt) from a scenario + uploaded docs."""

    def __init__(
        self,
        users_repo: Optional[UsersRepository] = None,
        personas_repo: Optional["PersonasRepository"] = None,
        session_materials_repo: Optional["SessionMaterialsRepository"] = None,
    ) -> None:
        # ``users_repo`` is optional so existing callers that don't yet wire it
        # keep working — we fall back to env var / generic name when absent.
        self.users_repo = users_repo
        # H2 — ``personas_repo`` and ``session_materials_repo`` are also
        # optional. When ``None`` the build path falls through to the
        # legacy behavior (no persona filtering, no session-materials
        # block). This is what lets us land H2 BEFORE H1 wires the
        # SQLite implementations + DI factories — the prompt builder
        # accepts both modes simultaneously.
        self.personas_repo = personas_repo
        self.session_materials_repo = session_materials_repo

    def build(
        self,
        *,
        scenario_id: str,
        user_id: str,
        current_transcript: str,
        past_questions: list[str],
        past_hints: list[str],
        scenarios_repo: ScenarioRepository,
        docs_repo: DocumentsRepository,
        document_ids: Optional[list[int]] = None,
        screen_text: Optional[str] = None,
        persona_id: Optional[int] = None,
        session_id: Optional[str] = None,
        mode: SessionMode = "agent",
    ) -> tuple[str, str]:
        """Returns (system_prompt, user_prompt).

        ``document_ids`` is the per-session identity-doc selection coming
        from ``session.metadata["document_ids"]`` (set by the
        NewSessionModal in the frontend). When provided AND non-empty,
        the ``{identity_docs}`` block is restricted to ONLY those ids
        that ALSO belong to the user and are identity-typed (defense in
        depth against a client lying about ids). When ``None`` or empty,
        ALL relevant identity docs are embedded (legacy behavior — keeps
        sessions created BEFORE this feature working unchanged).

        ``screen_text`` is the G2 OCR text extracted from the user's
        shared tab by the web client (tesseract.js, client-side). When
        provided AND non-empty, it fills the ``{screen_text_block}``
        placeholder in scenario system prompts with a uniform Spanish
        framing instructing the LLM to use it as ambient context. When
        ``None`` (no fresh extraction; filtered out by
        ``SessionConversationState.get_screen_text`` for staleness, low
        confidence, or emptiness) the block resolves to an empty string
        so the LLM sees NOTHING about screen context — preserving the
        no-screen baseline behavior unchanged.

        ``persona_id`` is the per-session persona pick read by
        ``ProcessTranscriptUseCase`` from ``session.metadata["persona_id"]``.
        Resolution chain (H2):
          1. ``persona_id`` explicit AND ``personas_repo`` wired →
             ``personas_repo.get(persona_id, user_id=user_id)``.
          2. ``persona_id`` missing or persona not found AND
             ``personas_repo`` wired → fall back to the user's default
             persona via ``personas_repo.get_default(user_id)``.
          3. No persona resolved (no system, no default, or repo not
             wired) → legacy behavior: ALL identity docs of relevant
             types flow into ``{identity_docs}`` unchanged.

        When a persona IS resolved, ``{identity_docs}`` is restricted to
        the documents linked to that persona with ``is_identity=True``;
        the persona's knowledge documents (``is_identity=False``) are
        appended to ``{reference_docs}``. The pre-existing
        ``document_ids`` filter is intersected with the persona filter
        when both are present (defense in depth — the user's Modal
        selection further narrows what the persona exposes).

        ``session_id`` enables the ``{session_materials_block}``
        placeholder: ad-hoc per-session material (brief, agenda, link,
        objective) uploaded by the user in the NewSessionModal. When
        ``session_materials_repo`` is wired AND there are materials
        attached to this session, the block is filled with a uniform
        Spanish framing instructing the LLM to use them as context.
        Empty list → empty block (no leak).
        """
        scenario = scenarios_repo.get(scenario_id)

        docs = docs_repo.list(
            user_id=user_id,
            scenario=scenario_id,
            include_global=True,
        )

        relevant_docs = [d for d in docs if d.doc_type in scenario.relevant_doc_types]

        identity_docs = [d for d in relevant_docs if d.doc_type in IDENTITY_DOC_TYPES]

        # H2 — persona resolution. Explicit ``persona_id`` wins; fall back
        # to the user's default persona; if both fail (or the repo isn't
        # wired yet during the H1+H2 rollout) we go down the legacy path
        # below (all identity docs of relevant types). ALL DB errors are
        # swallowed defensively — a persona system bug must NEVER take
        # down the transcript pipeline.
        active_persona: Optional["Persona"] = None
        if self.personas_repo is not None:
            if persona_id is not None:
                try:
                    active_persona = self.personas_repo.get(
                        persona_id, user_id=user_id,
                    )
                except Exception:  # noqa: BLE001
                    active_persona = None
            if active_persona is None:
                try:
                    active_persona = self.personas_repo.get_default(user_id)
                except Exception:  # noqa: BLE001
                    active_persona = None

        # Persona-aware doc filtering. When a persona resolved, ONLY the
        # docs linked to it as identity flow into ``{identity_docs}``.
        # When no persona resolved, ``identity_docs`` keeps the legacy
        # set (all CV/profile/linkedin/bio docs the user owns and that
        # the scenario considers relevant).
        persona_knowledge_docs: list[Document] = []
        if active_persona is not None and self.personas_repo is not None:
            try:
                persona_identity_ids = set(
                    self.personas_repo.list_documents(
                        persona_id=active_persona.id,
                        user_id=user_id,
                        is_identity=True,
                    )
                )
            except Exception:  # noqa: BLE001
                persona_identity_ids = set()
            try:
                persona_knowledge_ids = set(
                    self.personas_repo.list_documents(
                        persona_id=active_persona.id,
                        user_id=user_id,
                        is_identity=False,
                    )
                )
            except Exception:  # noqa: BLE001
                persona_knowledge_ids = set()
            # Restrict identity docs to ONLY those linked to the active
            # persona as identity. Anything outside the link table is
            # dropped — that's the whole point of the persona switch.
            identity_docs = [d for d in identity_docs if d.id in persona_identity_ids]
            # Knowledge docs are pulled from the FULL user-owned doc pool
            # (not just ``relevant_docs``) so e.g. the "Luis Carranza LLC"
            # persona can append a service catalog even on scenarios
            # whose ``relevant_doc_types`` don't include the catalog's
            # doc_type. The dedup vs ``reference_docs`` happens below.
            persona_knowledge_docs = [
                d for d in docs if d.id in persona_knowledge_ids
            ]

        # Per-session identity-doc filter. The pool above already enforces
        # ownership (``docs_repo.list(user_id=...)``) and identity-typing
        # (``IDENTITY_DOC_TYPES``), so intersecting with the requested
        # ids implicitly drops:
        #   * ids the user doesn't own
        #   * ids that point to a non-identity doc (job_offer, reference,
        #     etc — those still flow into ``scenario_docs`` /
        #     ``reference_docs`` below because the filter ONLY narrows
        #     the identity slot)
        #   * ids that don't exist at all
        # Empty list and ``None`` are both treated as "no filter — embed
        # ALL identity docs" so legacy sessions (no ``document_ids`` in
        # metadata) keep working unchanged.
        # NOTE: ``document_ids`` is intersected AFTER the persona filter
        # so the Modal pick further narrows what the persona exposes.
        if document_ids:
            allowed_ids = set(document_ids)
            identity_docs = [d for d in identity_docs if d.id in allowed_ids]

        # Wave 2A — primary identity docs (Principal star ⭐) first so the
        # LLM sees the user-curated CV before any other identity doc.
        # Defensive: the SQLite repo already orders by ``is_primary DESC,
        # uploaded_at DESC``, but other implementations may not — explicit
        # stable sort here keeps the contract guaranteed at the
        # application layer. ``sorted(..., key=...)`` is stable so the
        # secondary order (whatever the repo returned) is preserved.
        identity_docs.sort(key=lambda d: 0 if getattr(d, "is_primary", False) else 1)
        reference_docs = [d for d in relevant_docs if d.doc_type in REFERENCE_DOC_TYPES]
        # Append persona-linked knowledge docs to reference_docs (dedup
        # by id so a doc that's BOTH "reference" type AND linked to the
        # persona doesn't appear twice in the prompt).
        if persona_knowledge_docs:
            seen_ref_ids = {d.id for d in reference_docs}
            for d in persona_knowledge_docs:
                if d.id not in seen_ref_ids:
                    reference_docs.append(d)
                    seen_ref_ids.add(d.id)
        scenario_docs = [
            d
            for d in relevant_docs
            if d.doc_type not in IDENTITY_DOC_TYPES
            and d.doc_type not in REFERENCE_DOC_TYPES
        ]

        identity_context = (
            self._format_docs(identity_docs) or self._fallback_candidate_context()
        )
        scenario_context = (
            self._format_docs(scenario_docs)
            or "(no hay contexto específico de la situación cargado)"
        )
        reference_context = (
            self._format_docs(reference_docs) or "(sin material de referencia cargado)"
        )

        candidate_name = self._resolve_candidate_name(user_id)

        # Conditional fail-loud block. ONLY injected when the candidate name
        # is the missing-profile placeholder — otherwise the LLM was
        # spuriously activating the fallback message on ambiguous transcripts
        # ("ahora", "este", etc.) because the instruction was always present.
        # Now the instruction simply doesn't exist when the name is real.
        if candidate_name == DEFAULT_CANDIDATE_NAME:
            fail_loud_block = (
                "- Tu nombre aparece como `"
                + DEFAULT_CANDIDATE_NAME
                + "` — eso significa que el sistema NO tiene tu nombre real "
                "cargado. NO inventes uno. En la PRIMERA pregunta que te "
                "hagan sobre vos (nombre, presentación, etc), respondé "
                "EXACTAMENTE: \"Mi perfil aún no tiene un nombre cargado. "
                "Completá tu perfil para personalizar las respuestas.\""
            )
        else:
            fail_loud_block = ""

        # G2 — screen OCR context block. Uniform across all 8 scenarios
        # so the LLM sees the same framing regardless of persona. When
        # no fresh screen text is available, the block resolves to an
        # empty string — ``str.replace`` then erases the placeholder
        # cleanly and the LLM sees nothing about screen context.
        if screen_text:
            screen_text_block = (
                "TEXTO VISIBLE EN PANTALLA AHORA "
                "(extraído por OCR del navegador cada 5s):\n\n"
                f"{screen_text}\n\n"
                "Usá este texto como contexto si el otro lado se refiere a algo "
                "que está en pantalla (slides, código, preguntas escritas, "
                "datos compartidos). No lo cites textualmente a menos que la "
                "pregunta lo requiera."
            )
        else:
            screen_text_block = ""

        # H2 — persona custom-instructions block. Appended at the END of
        # the system prompt (placeholder lives after ``{screen_text_block}``
        # in every scenario template) so the persona's voice overrides
        # the scenario default tone WITHOUT rewriting the scenario.
        # Empty when no persona resolved OR persona has no custom text.
        if (
            active_persona is not None
            and active_persona.custom_instructions
            and active_persona.custom_instructions.strip()
        ):
            persona_custom_instructions = (
                "INSTRUCCIONES PERSONALIZADAS DE TU PERSONA:\n"
                + active_persona.custom_instructions.strip()
            )
        else:
            persona_custom_instructions = ""

        # H2 — per-session materials block (brief, agenda, link, etc).
        # Read once per turn from the materials repo when wired. Errors
        # are swallowed — best-effort context must not break the pipe.
        session_materials_block = ""
        if (
            session_id is not None
            and self.session_materials_repo is not None
        ):
            try:
                materials = self.session_materials_repo.list_for_session(
                    session_id,
                )
            except Exception:  # noqa: BLE001
                materials = []
            if materials:
                session_materials_block = self._format_materials(materials)

        # ------------------------------------------------------------------
        # Mode branch: ``agent`` (default) → scenario.persona_system.
        # ``scribe`` → orthogonal note-taking template that adapts to the
        # scenario via ``{scenario_label}`` + ``{scenario_focus}``. Both
        # paths supply the SAME placeholder keys so ``_fill_template``
        # never leaves unresolved tokens — the difference is the TEMPLATE
        # string, not the data we hand it.
        # ------------------------------------------------------------------
        if mode == "scribe":
            # Imported locally to keep the import-time graph clean — the
            # scribe template lives in the scenarios infra package but
            # PromptBuilder is in application layer. Lazy import dodges
            # the layering nag without adding a port.
            from app.infrastructure.scenarios._scribe import (
                DEFAULT_FOCUS,
                SCRIBE_FOCUS_BY_SCENARIO,
                SCRIBE_SYSTEM_TEMPLATE,
                SCRIBE_USER_TEMPLATE,
            )

            scenario_focus = SCRIBE_FOCUS_BY_SCENARIO.get(
                scenario_id, DEFAULT_FOCUS,
            )
            system_template = SCRIBE_SYSTEM_TEMPLATE
            user_template = SCRIBE_USER_TEMPLATE
            # In scribe mode the LLM is a 3rd-person observer, so the
            # "fail-loud" instruction (which tells the LLM to say "Mi
            # perfil aún no tiene nombre cargado") is meaningless — it
            # would never speak in 1st person. We always supply an
            # empty fail_loud_block here so the template's placeholder
            # (if any) collapses cleanly.
            system_fail_loud = ""
        else:
            scenario_focus = ""
            system_template = scenario.persona_system
            user_template = scenario.user_template
            system_fail_loud = fail_loud_block

        # Shared placeholder map — both modes receive the SAME keys so a
        # mistake in one template doesn't blow up the other. Scribe-only
        # keys (``scenario_label``, ``scenario_focus``) are also passed
        # to the agent path (where ``str.replace`` ignores them silently
        # because the agent templates don't contain those tokens).
        system_values = {
            "candidate_name": candidate_name,
            "identity_docs": identity_context,
            "scenario_docs": scenario_context,
            "reference_docs": reference_context,
            "fail_loud_block": system_fail_loud,
            "screen_text_block": screen_text_block,
            "session_materials_block": session_materials_block,
            "persona_custom_instructions": persona_custom_instructions,
            # Scribe-only keys (agent templates don't reference them).
            "scenario_label": scenario.label,
            "scenario_focus": scenario_focus,
            # Backward-compat aliases.
            "candidate_context": identity_context,
            "scenario_context": scenario_context,
        }

        system = self._fill_template(system_template, system_values)

        n_questions = min(PAST_QUESTIONS_WINDOW, len(past_questions))
        n_hints = min(PAST_HINTS_WINDOW, len(past_hints))
        past_qs_text = (
            "\n".join(
                f"{i + 1}. {q}"
                for i, q in enumerate(past_questions[-PAST_QUESTIONS_WINDOW:])
            )
            or "(ninguna todavía)"
        )
        past_hints_text = (
            "\n".join(
                f"{i + 1}. → {h}"
                for i, h in enumerate(past_hints[-PAST_HINTS_WINDOW:])
            )
            or "(ningún hint todavía)"
        )

        user = self._fill_template(
            user_template,
            {
                "n_questions": str(n_questions),
                "past_questions": past_qs_text,
                "n_hints": str(n_hints),
                "past_hints": past_hints_text,
                "current_transcript": current_transcript,
            },
        )

        return system, user

    def _resolve_candidate_name(self, user_id: str) -> str:
        """Return the speaker's display name. Falls back to env / generic."""
        if self.users_repo is not None:
            try:
                user = self.users_repo.get_by_id(user_id)
            except Exception:  # noqa: BLE001
                user = None
            if user is not None and user.name and user.name.strip() and user.name != "Dev User":
                return user.name.strip()
        env_name = os.getenv("CANDIDATE_NAME")
        if env_name and env_name.strip():
            return env_name.strip()
        return DEFAULT_CANDIDATE_NAME

    @staticmethod
    def _fill_template(template: str, values: dict[str, str]) -> str:
        """Replace ``{key}`` placeholders by simple ``str.replace`` — robust to
        missing/extra keys (unlike ``str.format`` which raises ``KeyError``)."""
        out = template
        for key, value in values.items():
            out = out.replace("{" + key + "}", value)
        return out

    @staticmethod
    def _format_docs(docs: list[Document]) -> str:
        if not docs:
            return ""
        parts: list[str] = []
        for d in docs:
            parts.append(f"--- {d.title} ({d.doc_type}) ---\n{d.content.strip()}")
        return "\n\n".join(parts)

    @staticmethod
    def _format_materials(materials: list["SessionMaterial"]) -> str:
        """H2 — render ad-hoc per-session materials into a Spanish-framed
        block. Each material type renders differently so the LLM
        immediately recognises what kind of context it's reading.

        - ``link``                        → URL line with title.
        - ``brief`` / ``agenda`` / ``objective`` → labelled section with
          title + content.
        - other types                     → generic title + content.
        """
        if not materials:
            return ""
        parts: list[str] = ["MATERIAL DE ESTA SESIÓN:\n"]
        for m in materials:
            if m.material_type == "link":
                parts.append(
                    f"- URL: {m.source_url} — {m.title or '(sin título)'}"
                )
            elif m.material_type in ("brief", "agenda", "objective"):
                parts.append(
                    f"- {m.material_type.upper()}: {m.title}\n  "
                    f"{m.content or ''}"
                )
            else:
                parts.append(
                    f"- {m.title or m.material_type}: {m.content or ''}"
                )
        parts.append(
            "\nUsá este material como contexto. Si la pregunta se refiere "
            "directamente a algo del material, citá lo relevante."
        )
        return "\n".join(parts)

    @staticmethod
    def _fallback_candidate_context() -> str:
        return os.getenv(
            "CANDIDATE_PROFILE",
            "(sin perfil cargado todavía — el usuario aún no subió su CV)",
        )
