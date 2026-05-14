"""Stream agent response tokens. Pure orchestration: build prompt + LLM stream."""
import logging
from typing import Any, AsyncIterator, Optional

from app.application.ports.documents_repository import DocumentsRepository
from app.application.ports.conversation_repository import ConversationRepository
from app.application.ports.llm_provider import LLMProvider
from app.application.ports.scenario_repository import ScenarioRepository
from app.application.services.prompt_builder import (
    PAST_HINTS_WINDOW,
    PAST_QUESTIONS_WINDOW,
    PromptBuilder,
)
from app.domain.entities.chat_message import ChatMessage
from app.domain.entities.session import SessionMode


logger = logging.getLogger(__name__)

# 500 leaves room for reasoning trace + ~3-4 sentence content; 150 was insufficient
# for gpt-oss-style models.
RESPONSE_MAX_TOKENS = 500


# Module-level sentinel for the per-call ``reasoning`` override.
# Mirrors the OllamaCloudClient sentinel pattern so we can pass through
# "caller did not say" without collapsing it into "disable reasoning".
_UC_REASONING_UNSET: Any = object()


class GenerateResponseUseCase:
    """Streams agent response tokens. Pure orchestration: prompt + LLM."""

    def __init__(
        self,
        *,
        llm: LLMProvider,
        conversation_repo: ConversationRepository,
        prompt_builder: PromptBuilder,
        scenarios_repo: ScenarioRepository,
        docs_repo: DocumentsRepository,
        scenario_id: str,
        max_tokens: int = RESPONSE_MAX_TOKENS,
    ) -> None:
        self.llm = llm
        self.conv = conversation_repo
        self.prompt_builder = prompt_builder
        self.scenarios = scenarios_repo
        self.docs = docs_repo
        self.scenario_id = scenario_id
        self.max_tokens = max_tokens

    async def stream(
        self,
        *,
        transcript: str,
        session_id: str,
        user_id: Optional[str] = None,
        scenario_id: Optional[str] = None,
        max_tokens: Optional[int] = None,
        reasoning: Any = _UC_REASONING_UNSET,
        document_ids: Optional[list[int]] = None,
        screen_text: Optional[str] = None,
        persona_id: Optional[int] = None,
        mode: Optional[SessionMode] = None,
    ) -> AsyncIterator[str]:
        """Stream LLM tokens for the given transcript.

        Per-call knobs (forwarded to the LLM provider):
          * ``user_id`` — multi-tenant identity selector. The prompt
            builder uses it to resolve ``candidate_name`` from
            ``UsersRepository`` and to look up identity documents owned
            by THIS user. Without it the builder falls back to the
            ``[nombre — completá tu perfil...]`` placeholder, which
            triggers the ``{fail_loud_block}`` instruction in the
            system prompt and the LLM responds with "Mi perfil aún no
            tiene un nombre cargado..." — the exact bug we shipped in
            production when this argument was missing and we passed
            ``session_id`` (a UUID) instead.
          * ``max_tokens`` — overrides the use case's default cap. Set by
            the orchestrator from ``behavior.max_response_tokens()``.
          * ``reasoning`` — sentinel-aware override. ``_UC_REASONING_UNSET``
            means "use provider default"; ``None`` means "disable reasoning
            for this call"; a string ("low" / "medium" / "high") sets it.
          * ``document_ids`` — per-session identity-doc selection read
            from ``session.metadata["document_ids"]`` by the caller
            (``ProcessTranscriptUseCase``). Forwarded to
            ``PromptBuilder.build`` to restrict ``{identity_docs}`` to
            only those docs the user picked in the NewSessionModal.
            ``None`` or empty list → embed all identity docs (legacy).
          * ``screen_text`` — G2 screen OCR text from the user's shared
            tab, already filtered for freshness + confidence by the
            session state accessor. Forwarded to
            ``PromptBuilder.build`` which fills the
            ``{screen_text_block}`` placeholder in the scenario system
            prompt. ``None`` → empty block (no leak about screen state).
          * ``persona_id`` — H2 per-session persona pick read from
            ``session.metadata["persona_id"]`` by the caller. Forwarded
            to ``PromptBuilder.build`` so it can resolve the active
            persona, filter ``{identity_docs}`` to ONLY those linked to
            the persona, append the persona's knowledge docs to
            ``{reference_docs}``, and inject the persona's
            ``custom_instructions`` into the system prompt. ``None`` →
            falls back to the user's default persona (when wired) or to
            the legacy "all identity docs" behavior.
        """
        past_questions = [
            q.text
            for q in self.conv.get_recent_questions(
                session_id, n=PAST_QUESTIONS_WINDOW
            )
        ]
        past_hints = [
            h.text
            for h in self.conv.get_recent_hints(session_id, n=PAST_HINTS_WINDOW)
        ]

        # Defensive fallback: if no user_id is provided (legacy callers,
        # tests), fall back to the dev user. In production the rt_go
        # handler ALWAYS forwards user_id from the audio WS query params.
        resolved_user_id = user_id or "dev_default"

        # Multi-tenant: scenario_id comes from the caller (per-session
        # Modal pick). ``self.scenario_id`` is only the env-var default
        # used when no per-call scenario is supplied — that's the legacy
        # path for tests and bare /api/sessions calls that don't pass
        # through the new Modal flow.
        resolved_scenario_id = scenario_id or self.scenario_id

        # ``mode`` defaults to ``"agent"`` when not provided so legacy
        # callers (tests, internal scripts) keep the original
        # 1st-person agent behaviour without having to know about
        # scribe mode.
        resolved_mode: SessionMode = mode or "agent"

        system, user = self.prompt_builder.build(
            scenario_id=resolved_scenario_id,
            user_id=resolved_user_id,
            current_transcript=transcript,
            past_questions=past_questions,
            past_hints=past_hints,
            scenarios_repo=self.scenarios,
            docs_repo=self.docs,
            document_ids=document_ids,
            screen_text=screen_text,
            persona_id=persona_id,
            session_id=session_id,
            mode=resolved_mode,
        )

        effective_max_tokens = (
            max_tokens if max_tokens is not None else self.max_tokens
        )

        messages = [ChatMessage(role="user", content=user)]
        # Forward the sentinel as-is when the caller didn't override;
        # only pass an explicit value when they did. This keeps "did not
        # say" distinct from "disable" in the LLM client.
        if reasoning is _UC_REASONING_UNSET:
            async for token in self.llm.stream(
                messages, system=system, max_tokens=effective_max_tokens
            ):
                yield token
        else:
            async for token in self.llm.stream(
                messages,
                system=system,
                max_tokens=effective_max_tokens,
                reasoning_override=reasoning,
            ):
                yield token
