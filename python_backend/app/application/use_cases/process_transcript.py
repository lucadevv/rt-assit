"""Top-level use case for handling a transcript.

Fase B: this use case is now a THIN wrapper around the LangGraph
``TranscriptGraphOrchestrator``. The handler's call signature is
unchanged — the orchestrator is purely internal.

Responsibilities here (NOT in the graph):
  * Reject ``is_speculative=True`` transcripts so they bypass the
    coalesce/cancel/generate pipeline. Speculative previews are still
    broadcast by the WS handler (existing logic).
  * Manage per-session pending buffer + cancellation of the prior
    graph run. This MUST happen OUTSIDE the graph because a graph run
    cannot cancel itself.
  * Build the graph input state with a fresh history snapshot.
  * Spawn the graph run as an ``asyncio.Task`` we register on the
    session state so the NEXT transcript can cancel us.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Optional

from app.application.ports.client_publisher import ClientPublisher
from app.application.ports.conversation_repository import ConversationRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.application.services.behavior_registry import BehaviorRegistry
from app.application.services.question_filter import QuestionFilter  # noqa: F401  # retained for Fase A reversibility
from app.application.services.transcript_graph import (
    TranscriptGraphOrchestrator,
)
from app.application.services.transcript_graph_state import (
    TranscriptGraphState,
)
from app.application.services.transcript_session_state import (
    SessionStateRegistry,
)
from app.application.use_cases.generate_response import GenerateResponseUseCase
from app.application.use_cases.persist_hint import PersistHintUseCase
from app.application.use_cases.persist_transcript import PersistTranscriptUseCase
from app.domain.entities.session import SessionMode


logger = logging.getLogger(__name__)


class ProcessTranscriptUseCase:
    """Public-facing API for the WS handler. Internally delegates to the
    LangGraph orchestrator built at construction time.

    Speculative transcripts: returned to the handler immediately without
    going through the graph (no LLM call, no persistence). The handler's
    existing broadcast logic already shows them as previews.
    """

    def __init__(
        self,
        *,
        behavior_registry: BehaviorRegistry,
        scenario_id: str,
        generate_response: GenerateResponseUseCase,
        conversation_repo: ConversationRepository,
        client_publisher: ClientPublisher,
        sessions_repo: SessionsRepository,
        persist_transcript: PersistTranscriptUseCase,
        persist_hint: PersistHintUseCase,
        graph_orchestrator: TranscriptGraphOrchestrator,
        session_state_registry: SessionStateRegistry,
    ) -> None:
        # Most fields retained for backwards-compat / introspection by
        # downstream tooling — the graph orchestrator owns the live
        # collaborators.
        self.behavior_registry = behavior_registry
        self.scenario_id = scenario_id
        self.generate = generate_response
        self.conv = conversation_repo
        self.publisher = client_publisher
        self.sessions = sessions_repo
        self.persist_transcript = persist_transcript
        self.persist_hint = persist_hint
        self.graph = graph_orchestrator
        self.session_states = session_state_registry

    async def execute(
        self,
        *,
        transcript: str,
        is_speculative: bool,
        session_id: str,
        user_id: Optional[str] = None,
        deepgram_speaker: Optional[int] = None,
        language: Optional[str] = None,
        confidence: Optional[float] = None,
    ) -> None:
        logger.info(
            "[LLM] Processing transcript: %s... "
            "(speculative=%s, session=%s)",
            transcript[:50], is_speculative, session_id,
        )

        # Speculative transcripts bypass the graph. The WS handler is
        # responsible for previewing them; the rt_go side handles
        # speculative-cancellation already (rt_go_handler.py).
        if is_speculative:
            logger.info(
                "[LLM] Speculative transcript skipped graph (session=%s)",
                session_id,
            )
            return

        if not transcript or not transcript.strip():
            return

        session_state = self.session_states.get(session_id)

        # Under the session lock: decide whether to launch a new graph
        # or piggy-back on the one that's currently coalescing.
        #
        # If ``is_coalescing`` is True, a graph is mid-debounce — it's
        # sleeping in coalesce_node waiting for follow-up finals. We
        # APPEND the new transcript to ``pending`` and return. When the
        # sleep ends, coalesce_node drains pending and the join captures
        # our transcript as part of the same turn. No new graph, no
        # cancellation.
        #
        # If ``is_coalescing`` is False, either no graph is running OR a
        # graph is already past coalesce_node (running generate_node /
        # dedup_node). In the second case, we DO want to cancel — the
        # user has provided new input that supersedes the in-flight
        # LLM response.
        async with session_state.lock:
            session_state.add_pending(transcript)
            if session_state.is_coalescing:
                logger.info(
                    "[LLM] In-flight coalesce window absorbing transcript "
                    "(session=%s): %r",
                    session_id, transcript[:60],
                )
                return
            session_state.cancel_in_flight()

        # Drain the pending buffer ONCE here so the graph receives an
        # already-joined transcript. The coalesce_node will drain again
        # at the END of its window to catch any LATE arrivals.
        pending = session_state.drain_pending()
        if not pending:
            # Should never happen — we added to pending above. Defensive
            # fall-back to the raw transcript.
            pending = [transcript]

        # Join pending finals into one user turn.
        joined = " ".join(p.strip() for p in pending if p and p.strip())

        history_snapshot = session_state.get_history()

        # CRITICAL multi-tenant fix: read the scenario from the actual
        # Session row, NOT from the env-var-bound ``self.scenario_id``
        # (which is fixed at process startup and would force EVERY user's
        # turn into the same scenario regardless of what they picked in
        # the Modal). Without this, a user starting a `meeting_business`
        # session would still get the `interview_dev` persona.
        #
        # We ALSO read ``document_ids`` from ``session.metadata`` in the
        # SAME lookup so the prompt builder can restrict the
        # ``{identity_docs}`` block to the per-session selection picked
        # in the NewSessionModal. Sessions created BEFORE this feature
        # don't have the key → ``document_ids`` stays ``None`` → legacy
        # fallback (embed all identity docs).
        effective_scenario_id = self.scenario_id
        document_ids: Optional[list[int]] = None
        persona_id: Optional[int] = None
        # ``mode`` is a first-class column on ``sessions`` (added by the
        # session-mode migration), NOT something we read from metadata.
        # The repo's ``_row_to_session`` defaults to ``"agent"`` on
        # pre-migration rows so this is always either ``"agent"`` or
        # ``"scribe"`` — no ``None`` is expected, but we leave the
        # Optional contract on the graph state for forward compat with
        # future modes added without a default value.
        mode: SessionMode = "agent"
        if user_id:
            try:
                session_row = self.sessions.get(session_id, user_id)
                if session_row is not None:
                    if session_row.scenario:
                        effective_scenario_id = session_row.scenario
                    # First-class ``mode`` column — read directly from
                    # the session row. The repo guarantees it's a valid
                    # SessionMode literal (defaults to ``"agent"`` on
                    # corrupt / pre-migration rows).
                    mode = session_row.mode
                    # ``metadata`` is a dict (deserialised JSON). The
                    # frontend writes ``document_ids: number[]`` under
                    # ``metadata.document_ids``. Defensive cast: accept
                    # only a list of ints, otherwise stay ``None`` and
                    # fall back to the legacy "all identity docs"
                    # behavior. Clients can't break us by sending junk.
                    metadata = session_row.metadata or {}
                    raw_doc_ids = metadata.get("document_ids")
                    if isinstance(raw_doc_ids, list) and raw_doc_ids:
                        coerced: list[int] = []
                        for v in raw_doc_ids:
                            try:
                                coerced.append(int(v))
                            except (TypeError, ValueError):
                                continue
                        if coerced:
                            document_ids = coerced

                    # H2 — read the per-session persona pick. The
                    # NewSessionModal writes ``persona_id: number`` under
                    # ``metadata.persona_id``. Defensive cast: accept
                    # ints or numeric strings, drop anything else so a
                    # bad client can't crash the pipeline. ``None`` →
                    # prompt builder falls back to the user's default
                    # persona (resolved inside ``personas_repo``).
                    raw_persona = metadata.get("persona_id")
                    if isinstance(raw_persona, (int, str)):
                        try:
                            persona_id = int(raw_persona)
                        except (TypeError, ValueError):
                            persona_id = None
            except Exception:  # noqa: BLE001
                # Defensive — fall back to the env default if the lookup
                # fails for any reason. Logged so the leak is visible.
                logger.warning(
                    "[ProcessTranscript] Could not resolve session scenario "
                    "for %s — falling back to env default %r",
                    session_id, self.scenario_id,
                )

        # G2 — read the latest screen OCR extraction (if any). The state
        # accessor already enforces freshness + confidence + truncation,
        # so the graph state field is either a clean, prompt-ready string
        # or ``None``. Any failure here MUST NOT break the transcript
        # pipeline — screen text is best-effort context.
        screen_text: Optional[str] = None
        try:
            screen_text = session_state.get_screen_text()
        except Exception:  # noqa: BLE001
            logger.warning(
                "[ProcessTranscript] get_screen_text failed for session=%s "
                "— continuing without screen context",
                session_id,
            )

        graph_input: TranscriptGraphState = {
            "transcript": joined,
            "scenario_id": effective_scenario_id,
            "user_id": user_id,
            "session_id": session_id,
            "is_speculative": False,
            "deepgram_speaker": deepgram_speaker,
            "language": language,
            "confidence": confidence,
            "document_ids": document_ids,
            "screen_text": screen_text,
            "persona_id": persona_id,
            "mode": mode,
            "recent_history": history_snapshot,
            "pending_transcripts": [],
            "should_skip": False,
            "skip_reason": None,
            "response_text": None,
        }

        # Run the graph as a Task so we can register it for cancellation
        # by a subsequent turn. Note: ``generate_node`` ALSO registers
        # its inner LLM Task — both cancellation hooks are valid (the
        # graph-level cancel propagates into the LLM Task via the await).
        graph_task: asyncio.Task[TranscriptGraphState] = asyncio.create_task(
            self.graph.ainvoke(graph_input)
        )
        session_state.set_in_flight(graph_task)

        try:
            result = await graph_task
            if result.get("should_skip"):
                logger.info(
                    "[LLM] Graph skipped turn (reason=%s, session=%s)",
                    result.get("skip_reason"), session_id,
                )
        except asyncio.CancelledError:
            logger.info(
                "[LLM] Graph run cancelled by new turn (session=%s)",
                session_id,
            )
        except Exception as e:  # noqa: BLE001
            logger.exception("[LLM] Graph run failed: %s", e)
        finally:
            if session_state.get_in_flight() is graph_task:
                session_state.clear_in_flight()
