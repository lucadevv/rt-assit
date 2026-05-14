"""LangGraph state schema for the Fase B transcript pipeline.

The graph runs ONCE per "turn" (coalesced window of finals from a single
session). All cross-turn state (history, in-flight Task handle, pending
buffer) lives on the per-session ``SessionConversationState`` object —
the graph state is the immutable-per-run shapshot we hand to nodes.

NOTE: Pure stdlib types. LangGraph itself reads ``TypedDict`` shapes
via ``typing`` introspection so we don't need to import langgraph here.
This file stays import-safe even when langgraph isn't installed (e.g.
running ``python3 -m py_compile`` outside the Docker env)."""
from __future__ import annotations

from typing import Optional, TypedDict

from app.domain.entities.session import SessionMode


class TranscriptGraphState(TypedDict, total=False):
    """State for one run of the transcript graph.

    Fields marked ``input`` are populated by the caller (the use case).
    Fields marked ``node`` are populated by graph nodes during execution.
    The ``total=False`` flag means downstream nodes can omit fields they
    don't touch — LangGraph merges partial updates back into the state.
    """
    # ---- Input (set by ProcessTranscriptUseCase before invoke) ------
    transcript: str
    """The transcript text for this turn. If multiple finals arrived
    inside the coalesce window, this is the JOINED text (see
    ``coalesce_node``)."""

    scenario_id: str
    """Active scenario for the session — drives behavior policy."""

    user_id: Optional[str]
    session_id: str
    is_speculative: bool
    """Defensive: speculative transcripts should NEVER reach the graph
    (the use case filters them out), but we keep the field so the state
    shape is symmetrical for logging."""

    deepgram_speaker: Optional[int]
    language: Optional[str]
    confidence: Optional[float]

    document_ids: Optional[list[int]]
    """Per-session identity-doc selection picked by the user in the
    NewSessionModal. When set (non-empty list), the prompt builder
    restricts ``{identity_docs}`` to ONLY those doc ids. When ``None``
    or empty, falls back to embedding ALL relevant identity docs
    (legacy behavior). Read ONCE from
    ``session.metadata["document_ids"]`` by
    ``ProcessTranscriptUseCase`` and forwarded through the graph so the
    per-session pick is honored even though the prompt is rebuilt on
    every turn."""

    screen_text: Optional[str]
    """G2 — latest screen OCR extraction from the web client (if any),
    already filtered for freshness + confidence + truncation by
    ``SessionConversationState.get_screen_text``. ``None`` when there
    is no fresh extraction; the prompt builder maps that to an empty
    ``{screen_text_block}`` so the LLM sees nothing about screen
    context. Read ONCE per turn by
    ``ProcessTranscriptUseCase`` and forwarded to ``generate_response``
    via the graph so the prompt builder can inline it."""

    persona_id: Optional[int]
    """H2 — per-session persona pick read by
    ``ProcessTranscriptUseCase`` from
    ``session.metadata["persona_id"]``. Forwarded through the graph so
    each turn's prompt build honors the persona switch even though the
    prompt is rebuilt on every turn. ``None`` → fall back to the user's
    default persona (resolved inside the prompt builder); if no default
    exists either, the build path falls through to the legacy "all
    identity docs" behavior."""

    mode: Optional[SessionMode]
    """Session mode — read by ``ProcessTranscriptUseCase`` from the
    ``sessions.mode`` column (NOT metadata: ``mode`` is a first-class
    column on the sessions table). Forwarded through the graph so each
    turn's prompt build honors the mode choice even though the prompt is
    rebuilt every turn. ``None`` collapses to ``"agent"`` inside
    ``GenerateResponseUseCase.stream`` so legacy callers / pre-migration
    rows keep the original behaviour."""

    # ---- Cross-turn (populated from SessionConversationState) -------
    recent_history: list[str]
    """Last N finals for this session (for context-aware
    ``should_respond`` policy). Populated by the use case BEFORE
    invoking the graph."""

    pending_transcripts: list[str]
    """Snapshot of the per-session pending buffer at invoke time. The
    coalesce node may extend this with finals that arrive WHILE the
    coalesce window is open."""

    # ---- Decision flags (filled by nodes) ---------------------------
    should_skip: bool
    """True if a node decided this turn shouldn't generate a response."""

    skip_reason: Optional[str]
    """Human-readable reason for skip — useful in logs/metrics."""

    # ---- Output (filled by ``generate_node``) -----------------------
    response_text: Optional[str]
    """Full assembled response from the LLM stream, or None on skip."""
