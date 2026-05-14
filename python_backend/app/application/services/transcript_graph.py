"""Fase B — LangGraph state machine that wraps the transcript pipeline.

Graph topology (one run == one coalesced "turn"):

    filter -> coalesce -> cancel_inflight -> generate -> dedup -> END
       \\                                                          /
        \\---- (should_skip via conditional edge) ---------------> END

Responsibilities per node:

  * ``filter_node``     — persist transcript (best-effort) + run
                          ``behavior.should_respond(coalesced, history)``.
                          Sets ``should_skip`` if the policy rejects.
  * ``coalesce_node``   — sleep ``behavior.coalesce_window_ms()`` and
                          absorb any finals that arrived during the
                          window. Returns the joined transcript.
  * ``cancel_inflight`` — cancel the previous turn's LLM Task (if any).
                          Defensive: ``ProcessTranscriptUseCase`` ALSO
                          calls this BEFORE invoking the graph (so the
                          stale stream stops emitting tokens ASAP) but
                          we keep it here so the graph is correct in
                          isolation.
  * ``generate_node``   — spawn the LLM stream as an ``asyncio.Task``,
                          register it as the in-flight task, and await
                          it. ``CancelledError`` flips ``should_skip``.
  * ``dedup_node``      — skip persistence + history append when the
                          response is identical to the previous one
                          (avoid repeating ourselves on rapid retries).

Cancellation primitive: ``asyncio.Task.cancel()`` + ``try/except
CancelledError``. The generate node creates the Task and registers it
with ``SessionConversationState.set_in_flight``. A subsequent turn calls
``session_state.cancel_in_flight()``, which schedules the
``CancelledError`` to fire at the next await inside the streaming loop.
"""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any, Awaitable, Callable, Optional

from langgraph.graph import END, START, StateGraph

from app.application.ports.client_publisher import ClientPublisher
from app.application.ports.conversation_repository import ConversationRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.application.services.behavior_registry import BehaviorRegistry
from app.application.services.transcript_graph_state import TranscriptGraphState
from app.application.services.transcript_session_state import (
    SessionStateRegistry,
)
from app.application.use_cases.generate_response import GenerateResponseUseCase
from app.application.use_cases.persist_hint import PersistHintUseCase
from app.application.use_cases.persist_transcript import PersistTranscriptUseCase


logger = logging.getLogger(__name__)


def _join_transcripts(parts: list[str]) -> str:
    """Join coalesced transcripts with a single space, trimming each
    fragment. Empty fragments are dropped. We avoid clever punctuation
    because Deepgram already inserts terminal punctuation on finals."""
    cleaned = [p.strip() for p in parts if p and p.strip()]
    return " ".join(cleaned)


class TranscriptGraphOrchestrator:
    """Builds and exposes a compiled LangGraph for transcript turns.

    Stateless across sessions — all per-session state lives in
    ``SessionStateRegistry``. One orchestrator instance handles every
    session (LangGraph compiles ONCE at construction)."""

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
        session_state_registry: SessionStateRegistry,
    ) -> None:
        self.behavior_registry = behavior_registry
        self.scenario_id = scenario_id
        self.generate = generate_response
        self.conv = conversation_repo
        self.publisher = client_publisher
        self.sessions = sessions_repo
        self.persist_transcript = persist_transcript
        self.persist_hint = persist_hint
        self.session_states = session_state_registry

        # Per-session bookkeeping that ISN'T behavioural state — just
        # transient values needed inside one graph run (persisted ids,
        # session start ts). Keyed by ``session_id``.
        self._persistence_ctx: dict[str, dict[str, Any]] = {}

        self._graph = self._build_graph()

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    @property
    def graph(self) -> Any:
        """Compiled LangGraph (CompiledStateGraph). Exposed for tests +
        the smoke test in the Fase B spec."""
        return self._graph

    async def ainvoke(self, state: TranscriptGraphState) -> TranscriptGraphState:
        """Run the graph for one turn. The caller (use case) is
        responsible for cancelling any in-flight Task BEFORE invoking
        and for registering this run's Task on the session state."""
        result = await self._graph.ainvoke(state)
        # LangGraph returns the merged state dict; cast to our TypedDict.
        return result  # type: ignore[return-value]

    # ------------------------------------------------------------------
    # Graph build
    # ------------------------------------------------------------------

    def _build_graph(self) -> Any:
        g = StateGraph(TranscriptGraphState)

        g.add_node("filter", self._filter_node)
        g.add_node("coalesce", self._coalesce_node)
        g.add_node("generate", self._generate_node)
        g.add_node("dedup", self._dedup_node)

        g.add_edge(START, "filter")
        g.add_conditional_edges(
            "filter",
            self._skip_or_continue,
            {"continue": "coalesce", "skip": END},
        )
        # Direct edge — the legacy ``cancel_inflight_node`` was a
        # self-destruct: the graph's own Task is registered as the
        # session's in-flight slot (by the use case), so a node calling
        # ``cancel_in_flight()`` cancels its OWN graph. The cancellation
        # contract lives in ``ProcessTranscriptUseCase.execute()`` — it
        # cancels any prior Task BEFORE invoking a new graph run.
        g.add_edge("coalesce", "generate")
        g.add_conditional_edges(
            "generate",
            self._skip_or_continue,
            {"continue": "dedup", "skip": END},
        )
        g.add_edge("dedup", END)

        return g.compile()

    # ------------------------------------------------------------------
    # Conditional edge helper
    # ------------------------------------------------------------------

    @staticmethod
    def _skip_or_continue(state: TranscriptGraphState) -> str:
        return "skip" if state.get("should_skip") else "continue"

    # ------------------------------------------------------------------
    # Nodes
    # ------------------------------------------------------------------

    async def _filter_node(
        self, state: TranscriptGraphState
    ) -> dict[str, Any]:
        """Persist (best-effort) + run the behavior policy."""
        transcript = state["transcript"]
        session_id = state["session_id"]
        user_id = state.get("user_id")
        recent_history = state.get("recent_history") or []

        # 1) Best-effort persistence. Speculative transcripts never reach
        #    the graph (use case filters them), so we treat everything
        #    here as a final.
        persisted_id: Optional[int] = None
        session_started_at_ms: Optional[int] = None
        is_persistent = False

        if user_id:
            session = self.sessions.get(session_id, user_id)
            if session is not None:
                is_persistent = True
                started_ms = int(session.started_at.timestamp() * 1000)
                session_started_at_ms = started_ms
                ts_ms = max(0, int(time.time() * 1000) - started_ms)
                try:
                    persisted = self.persist_transcript.execute(
                        session_id=session_id,
                        content=transcript,
                        is_final=True,
                        timestamp_ms=ts_ms,
                        deepgram_speaker=state.get("deepgram_speaker"),
                        language=state.get("language"),
                        confidence=state.get("confidence"),
                    )
                    persisted_id = persisted.id
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        "[Graph:filter] Transcript persist failed for %s: %s",
                        session_id, e,
                    )
            else:
                logger.warning(
                    "[Graph:filter] No session row for session_id=%s "
                    "user_id=%s — skipping transcript persist",
                    session_id, user_id,
                )

        # Stash persistence context for the dedup node.
        self._persistence_ctx[session_id] = {
            "is_persistent": is_persistent,
            "persisted_transcript_id": persisted_id,
            "session_started_at_ms": session_started_at_ms,
        }

        # 2) Behavior policy. ``scenario_id`` is read from the GRAPH STATE
        # (per-turn) not from ``self.scenario_id`` (process startup env
        # var) so each turn uses the behavior of whichever scenario was
        # picked in the Modal for THIS session.
        turn_scenario_id = state.get("scenario_id") or self.scenario_id
        behavior = self.behavior_registry.get(turn_scenario_id)
        if not behavior.should_respond(transcript, recent_history):
            logger.info(
                "[Graph:filter] Skipping non-actionable transcript: %r "
                "(scenario=%s, history_len=%d)",
                transcript[:60], turn_scenario_id, len(recent_history),
            )
            return {"should_skip": True, "skip_reason": "behavior_filter"}

        # Fase E2 — Confidence gating. Deepgram occasionally emits
        # low-confidence finals on noisy or unclear audio. When the
        # per-scenario threshold rejects them we skip the LLM and emit a
        # WS ``unclear`` phase so the UI prompts the user to repeat.
        # ``confidence == 0.0`` means "Deepgram has no estimate" and is
        # intentionally NOT gated (we'd lose every silent-confidence
        # final that's actually valid).
        confidence_raw = state.get("confidence")
        confidence = float(confidence_raw) if confidence_raw is not None else 0.0
        threshold = behavior.min_confidence()
        if confidence > 0.0 and confidence < threshold:
            logger.info(
                "[Graph:filter] Low confidence (%.2f < %.2f) — skip "
                "(scenario=%s, transcript=%r)",
                confidence, threshold, turn_scenario_id, transcript[:60],
            )
            # Tell the UI we heard the user but it was unclear, so the
            # phase indicator can render "No te escuché bien — repetí
            # por favor". Best-effort: a publisher failure should not
            # break the graph turn.
            try:
                await self.publisher.broadcast({"type": "unclear"})
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "[Graph:filter] unclear broadcast failed: %s", e,
                )
            return {"should_skip": True, "skip_reason": "low_confidence"}

        return {"should_skip": False}

    async def _coalesce_node(
        self, state: TranscriptGraphState
    ) -> dict[str, Any]:
        """Sleep ``behavior.coalesce_window_ms()`` and absorb any finals
        that arrived in the meantime.

        Implementation: sleep on the wall clock; afterwards, drain the
        session's pending buffer. If new transcripts are found, JOIN
        them with the current transcript and update the state.

        Coalescing gate: while sleeping, we set
        ``session_state.is_coalescing = True`` so the use case knows NOT
        to cancel us when a new transcript arrives — it just appends to
        ``pending`` and we absorb it on drain. Without this gate, rapid
        Deepgram finals (e.g. a user speaking continuously) cancelled
        the graph on every turn and the LLM never ran.
        """
        turn_scenario_id = state.get("scenario_id") or self.scenario_id
        behavior = self.behavior_registry.get(turn_scenario_id)
        window_ms = behavior.coalesce_window_ms()
        session_id = state["session_id"]
        session_state = self.session_states.get(session_id)

        if window_ms > 0:
            session_state.is_coalescing = True
            window_started_at = time.monotonic()
            try:
                # Fase C — race the wall-clock window against Deepgram's
                # explicit UtteranceEnd signal. Whichever fires first wins:
                #   * Signal wins → user paused early, we proceed to the
                #     LLM right away (latency win).
                #   * Timeout wins → no signal arrived within the budget,
                #     fall back to the legacy wall-clock behaviour.
                # ``wait_for_utterance_end`` RESETS the underlying event at
                # the start of the call, so stale signals from prior turns
                # cannot collapse this window to zero.
                signalled = await session_state.wait_for_utterance_end(
                    timeout=window_ms / 1000.0,
                )
                elapsed_ms = int((time.monotonic() - window_started_at) * 1000)
                if signalled:
                    logger.info(
                        "[Graph:coalesce] Exit via UtteranceEnd "
                        "(waited %dms of %dms budget, session=%s)",
                        elapsed_ms, window_ms, session_id,
                    )
                else:
                    logger.info(
                        "[Graph:coalesce] Exit via timer "
                        "(%dms budget elapsed, session=%s)",
                        window_ms, session_id,
                    )
            except asyncio.CancelledError:
                # We get here only on explicit teardown (session ended);
                # the use case won't cancel us during the window any
                # more thanks to the ``is_coalescing`` gate.
                logger.info(
                    "[Graph:coalesce] Cancelled during %dms window for %s",
                    window_ms, session_id,
                )
                raise
            finally:
                session_state.is_coalescing = False

        # Drain any finals that landed during the window.
        extras = session_state.drain_pending()
        if extras:
            merged = _join_transcripts([state["transcript"], *extras])
            logger.info(
                "[Graph:coalesce] Coalesced %d extra final(s) into: %r",
                len(extras), merged[:80],
            )
            return {"transcript": merged}

        return {}

    async def _cancel_inflight_node(
        self, state: TranscriptGraphState
    ) -> dict[str, Any]:
        """Cancel the previous turn's in-flight LLM Task (if any).

        The use case ALREADY does this before invoking the graph for the
        common case (new transcript arrived). We keep the node so the
        graph is correct standalone (e.g. tests that invoke it directly)
        and so we explicitly clear the slot before ``generate_node``
        registers its own task."""
        session_state = self.session_states.get(state["session_id"])
        cancelled = session_state.cancel_in_flight()
        if cancelled:
            logger.info(
                "[Graph:cancel_inflight] Cancelled prior LLM task for %s",
                state["session_id"],
            )
        session_state.clear_in_flight()
        return {}

    async def _generate_node(
        self, state: TranscriptGraphState
    ) -> dict[str, Any]:
        """Spawn the LLM stream as a cancellable Task and await it."""
        transcript = state["transcript"]
        session_id = state["session_id"]
        # CRITICAL: forward user_id to the GenerateResponse so the prompt
        # builder can resolve ``candidate_name`` from the multi-tenant
        # UsersRepository. Without this the builder fell back to the
        # ``[nombre — completá tu perfil...]`` placeholder, which triggers
        # the fail_loud_block and the LLM responds "Mi perfil aún no tiene
        # un nombre cargado." This was the bug that survived through
        # Fase A-D until we found GenerateResponse was passing session_id
        # (a UUID) as user_id.
        user_id = state.get("user_id")
        is_speculative = bool(state.get("is_speculative"))
        msg_type = "response_speculative" if is_speculative else "response"
        session_state = self.session_states.get(session_id)

        # Fase D — pull per-scenario LLM knobs from the behavior so each
        # scenario uses the right token budget AND reasoning effort.
        # ``reasoning`` is passed as the literal value the behavior returns
        # ("low" / "medium" / "high" / None). ``None`` means "disable
        # reasoning for THIS call" — the sentinel pattern in the use case
        # and LLM client keeps it distinct from "caller didn't say".
        # The scenario id is read from the turn STATE (per-session), not
        # the orchestrator's startup-bound default — same fix as the
        # filter_node so each session uses its own scenario.
        turn_scenario_id = state.get("scenario_id") or self.scenario_id
        behavior = self.behavior_registry.get(turn_scenario_id)
        scenario_max_tokens = behavior.max_response_tokens()
        scenario_reasoning = behavior.reasoning_effort()

        # Per-session identity-doc selection. Read by the use case from
        # ``session.metadata["document_ids"]`` and forwarded through the
        # graph state so each turn's prompt build honors the Modal pick.
        # ``None`` or empty → embed all identity docs (legacy behavior).
        document_ids = state.get("document_ids")
        # G2 — screen OCR text already filtered for freshness + confidence
        # by the use case. ``None`` means "no fresh screen context" and
        # the prompt builder emits an empty ``{screen_text_block}``.
        screen_text = state.get("screen_text")
        # H2 — per-session persona pick. ``None`` → prompt builder falls
        # back to the user's default persona (resolved inside the prompt
        # builder when ``personas_repo`` is wired), and ultimately to
        # the legacy "all identity docs" behavior when nothing resolves.
        persona_id = state.get("persona_id")
        # Session mode — ``"agent"`` (default) vs ``"scribe"``. ``None``
        # is forwarded as-is; ``GenerateResponseUseCase.stream`` and
        # ``PromptBuilder.build`` both default missing/None → ``"agent"``
        # so legacy callers and pre-migration rows keep their behaviour.
        mode = state.get("mode")

        # Wrap the streaming loop in an explicit Task so we can register
        # it on the session state and a future turn can cancel it.
        async def _run_llm() -> str:
            parts: list[str] = []
            sent_thinking = False
            sent_responding = False
            async for token in self.generate.stream(
                transcript=transcript,
                session_id=session_id,
                user_id=user_id,
                scenario_id=turn_scenario_id,
                max_tokens=scenario_max_tokens,
                reasoning=scenario_reasoning,
                document_ids=document_ids,
                screen_text=screen_text,
                persona_id=persona_id,
                mode=mode,
            ):
                if not token:
                    continue
                if not sent_thinking:
                    await self.publisher.broadcast(
                        {"type": "thinking", "text": ""}
                    )
                    sent_thinking = True
                # Cambio 1 — explicit "responding" edge so the frontend
                # AgentPhase flips from "Pensando…" to "Respondiendo…"
                # the instant we have something to stream. This precedes
                # the per-token broadcast below so the indicator leads
                # the eye by one event.
                if not sent_responding:
                    await self.publisher.broadcast({"type": "responding"})
                    sent_responding = True
                parts.append(token)
                await self.publisher.broadcast(
                    {"type": msg_type, "text": token}
                )
            return "".join(parts).strip()

        task: asyncio.Task[str] = asyncio.create_task(_run_llm())
        session_state.set_in_flight(task)

        try:
            full = await task
        except asyncio.CancelledError:
            logger.info(
                "[Graph:generate] LLM stream cancelled by new turn for %s",
                session_id,
            )
            return {"should_skip": True, "skip_reason": "cancelled"}
        except Exception as e:  # noqa: BLE001
            logger.exception("[Graph:generate] Streaming failed: %s", e)
            return {"should_skip": True, "skip_reason": "stream_error"}
        finally:
            # Only clear if we still own the slot (a new turn may have
            # replaced it via cancel_inflight on its own graph run).
            if session_state.get_in_flight() is task:
                session_state.clear_in_flight()

        # Empty-response retry + fallback (mirrors the legacy
        # ProcessTranscriptUseCase behavior so we don't regress on
        # gpt-oss empty-stream quirks).
        if not full:
            logger.warning(
                "[Graph:generate] Empty response, retrying once for: %r",
                transcript,
            )
            retry_prompt = (
                f"El usuario dijo: '{transcript}'. "
                f"Generá una respuesta breve útil."
            )

            async def _run_retry() -> str:
                parts2: list[str] = []
                sent_thinking2 = False
                sent_responding2 = False
                async for token in self.generate.stream(
                    transcript=retry_prompt,
                    session_id=session_id,
                    user_id=user_id,
                    scenario_id=turn_scenario_id,
                    max_tokens=scenario_max_tokens,
                    reasoning=scenario_reasoning,
                    document_ids=document_ids,
                    screen_text=screen_text,
                    persona_id=persona_id,
                    mode=mode,
                ):
                    if not token:
                        continue
                    if not sent_thinking2:
                        await self.publisher.broadcast(
                            {"type": "thinking", "text": ""}
                        )
                        sent_thinking2 = True
                    # Mirror of the main streaming loop — emit the
                    # "responding" phase edge on the first retry token.
                    if not sent_responding2:
                        await self.publisher.broadcast(
                            {"type": "responding"}
                        )
                        sent_responding2 = True
                    parts2.append(token)
                    await self.publisher.broadcast(
                        {"type": msg_type, "text": token}
                    )
                return "".join(parts2).strip()

            retry_task: asyncio.Task[str] = asyncio.create_task(_run_retry())
            session_state.set_in_flight(retry_task)
            try:
                full = await retry_task
            except asyncio.CancelledError:
                logger.info(
                    "[Graph:generate] Retry cancelled for %s", session_id,
                )
                return {"should_skip": True, "skip_reason": "cancelled"}
            except Exception as e:  # noqa: BLE001
                logger.exception(
                    "[Graph:generate] Retry streaming failed: %s", e,
                )
                full = ""
            finally:
                if session_state.get_in_flight() is retry_task:
                    session_state.clear_in_flight()

            if not full:
                fallback = (
                    "Disculpame, no entendí bien la pregunta. "
                    "¿Podés repetirla?"
                )
                logger.error(
                    "[Graph:generate] Both attempts empty; sending fallback "
                    "for: %r", transcript,
                )
                await self.publisher.broadcast(
                    {"type": msg_type, "text": fallback}
                )
                full = fallback

        logger.info(
            "[Graph:generate] Streaming complete: %s... (speculative=%s)",
            full[:80], is_speculative,
        )
        return {"should_skip": False, "response_text": full}

    async def _dedup_node(
        self, state: TranscriptGraphState
    ) -> dict[str, Any]:
        """Persist hint + add to history, unless the response is a
        duplicate of the most recent one for this session."""
        transcript = state["transcript"]
        session_id = state["session_id"]
        response = state.get("response_text") or ""
        is_speculative = bool(state.get("is_speculative"))
        session_state = self.session_states.get(session_id)

        if not response:
            return {}

        # Dedup check — compare against the last hint in conv memory.
        recent_hints = self.conv.get_recent_hints(session_id, n=1)
        if recent_hints and recent_hints[0].text.strip() == response.strip():
            logger.info(
                "[Graph:dedup] Skipping duplicate response for %s: %r",
                session_id, response[:60],
            )
            # Still add the user's turn to history so future
            # ``should_respond`` calls see it.
            session_state.add_to_history(transcript)
            return {}

        # Record Q+A in conversation memory.
        self.conv.add_question(session_id, transcript)
        self.conv.add_hint(
            session_id, response, related_question=transcript,
        )

        # Append the user's transcript to history (last-N=3 finals).
        session_state.add_to_history(transcript)

        # Persist hint (best-effort, only for non-speculative + when
        # we have a real session row).
        ctx = self._persistence_ctx.pop(session_id, None) or {}
        if ctx.get("is_persistent") and not is_speculative:
            try:
                started_ms = ctx.get("session_started_at_ms") or 0
                ts_ms = max(0, int(time.time() * 1000) - started_ms)
                self.persist_hint.execute(
                    session_id=session_id,
                    content=response,
                    timestamp_ms=ts_ms,
                    related_transcript_id=ctx.get("persisted_transcript_id"),
                )
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    "[Graph:dedup] Hint persist failed for %s: %s",
                    session_id, e,
                )

        return {}


def build_transcript_graph(
    *,
    behavior_registry: BehaviorRegistry,
    scenario_id: str,
    generate_response: GenerateResponseUseCase,
    conversation_repo: ConversationRepository,
    client_publisher: ClientPublisher,
    sessions_repo: SessionsRepository,
    persist_transcript: PersistTranscriptUseCase,
    persist_hint: PersistHintUseCase,
    session_state_registry: SessionStateRegistry,
) -> TranscriptGraphOrchestrator:
    """Factory — keeps the DI layer free of LangGraph imports."""
    return TranscriptGraphOrchestrator(
        behavior_registry=behavior_registry,
        scenario_id=scenario_id,
        generate_response=generate_response,
        conversation_repo=conversation_repo,
        client_publisher=client_publisher,
        sessions_repo=sessions_repo,
        persist_transcript=persist_transcript,
        persist_hint=persist_hint,
        session_state_registry=session_state_registry,
    )
