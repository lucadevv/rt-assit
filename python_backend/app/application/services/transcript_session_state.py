"""Per-session in-memory state for the Fase B transcript graph.

LangGraph itself is stateless across invocations: each ``ainvoke()`` call
gets a fresh ``TranscriptGraphState`` dict. To survive across turns we
need a side-channel that holds:

  * The recent-finals history (for context-aware ``should_respond``).
  * The currently-running graph ``asyncio.Task`` so a NEW transcript can
    cancel the in-flight LLM stream from the PREVIOUS turn.
  * A pending buffer of finals that arrived during the coalesce window.

This module is pure stdlib (no langgraph import) so it stays trivially
testable and the domain layer never sees framework leakage."""
from __future__ import annotations

import asyncio
import logging
import time
from collections import deque
from typing import Optional


_logger = logging.getLogger(__name__)


# G2 — OCR text from the user's shared screen is pushed via WS into the
# per-session state. These defaults are the contract the use case + prompt
# builder rely on when they call ``get_screen_text()`` without overrides.
SCREEN_TEXT_MIN_CONFIDENCE = 0.5
SCREEN_TEXT_STALE_WINDOW_SECONDS = 60.0
SCREEN_TEXT_MAX_CHARS = 1500


class SessionConversationState:
    """Mutable per-session state. NOT thread-safe on its own — guarded by
    an internal ``asyncio.Lock``. All async accessors take the lock.

    Sync accessors (``get_history``) return COPIES so callers can read
    without locking (snapshots are cheap, and the graph state needs a
    plain list anyway).
    """

    def __init__(self, *, history_limit: int = 3) -> None:
        self._history: deque[str] = deque(maxlen=history_limit)
        self._in_flight: Optional[asyncio.Task] = None
        self._pending: list[str] = []
        self._lock = asyncio.Lock()
        # Set by the coalesce_node while it's sleeping the per-scenario
        # debounce window. While True, the use case must NOT cancel the
        # in-flight graph for new transcripts — it must only add them to
        # ``_pending`` and let the still-sleeping coalesce_node absorb
        # them when its sleep ends. Without this gate, every new final
        # arriving during the window restarts the graph, producing the
        # observed "[Graph:cancel_inflight] Cancelled prior LLM task"
        # loop where the LLM never actually runs.
        self.is_coalescing: bool = False
        # Fase C — UtteranceEnd early-exit signal. Deepgram emits an
        # explicit "I detected the speaker finished" event after N ms of
        # silence following a is_final transcript. rt_go forwards it as a
        # WS message type=utterance_end; the rt_go handler calls
        # ``signal_utterance_end()`` which fires this event. The
        # coalesce_node awaits ``wait_for_utterance_end(timeout=window_ms/1000)``
        # — whichever fires first (signal or timeout) wins, eliminating
        # the wall-clock latency tax when the user actually paused early.
        #
        # IMPORTANT: the event is RESET at the start of every wait_for_utterance_end
        # call so a stale signal from a prior turn cannot leak into the
        # next coalesce window and skip it entirely.
        self._utterance_end_event: asyncio.Event = asyncio.Event()
        # Cambio 1 — "duplex cognitivo" phase indicator. The rt_go
        # handler emits a single {"type":"listening"} broadcast the FIRST
        # time an interim (non-final) transcript arrives for a turn so
        # the frontend can flip its AgentPhase to "listening" without us
        # spamming the WS on every Deepgram partial. The flag is reset
        # when a final transcript is processed so the NEXT turn gets its
        # own listening edge.
        self.listening_emitted_for_current_turn: bool = False
        # G2 — screen OCR text pushed by the web client. The web client
        # extracts text from the shared MediaStream every 5s via
        # tesseract.js and emits ``{"type":"screen_text", ...}`` on the
        # /ws/web socket. The handler routes the payload to
        # ``set_screen_text`` so the next transcript turn can read it via
        # ``get_screen_text`` and thread it into the prompt builder. Only
        # the LATEST extraction is kept (idempotent overwrite). No DB,
        # no history — privacy by design.
        self._screen_text: str = ""
        self._screen_text_confidence: float = 0.0
        self._screen_text_captured_at_ms: int = 0  # epoch ms

    # -- history -----------------------------------------------------

    def get_history(self) -> list[str]:
        """Snapshot of the last-N finals (newest last). Safe to call
        from anywhere — no lock needed because we return a copy."""
        return list(self._history)

    def add_to_history(self, transcript: str) -> None:
        """Append a final to history. The deque caps to ``history_limit``."""
        if transcript and transcript.strip():
            self._history.append(transcript)

    # -- in-flight task ---------------------------------------------

    def get_in_flight(self) -> Optional[asyncio.Task]:
        return self._in_flight

    def set_in_flight(self, task: asyncio.Task) -> None:
        self._in_flight = task

    def clear_in_flight(self) -> None:
        self._in_flight = None

    def cancel_in_flight(self) -> bool:
        """Cancel the currently-running task (if any). Returns True if a
        task was found and ``cancel()`` was called. The caller is NOT
        responsible for awaiting the cancellation — ``asyncio.Task.cancel``
        schedules a ``CancelledError`` at the next await point in the
        target task, which surfaces inside the graph node that owns it.
        """
        task = self._in_flight
        if task is None or task.done():
            return False
        _logger.info("[SessionState] Cancelling in-flight task")
        task.cancel()
        return True

    # -- pending buffer ---------------------------------------------

    def add_pending(self, transcript: str) -> None:
        """Append a transcript to the pending buffer. The graph drains
        this buffer at the START of each run and again at the END of the
        coalesce window."""
        if transcript and transcript.strip():
            self._pending.append(transcript)

    def drain_pending(self) -> list[str]:
        """Return all pending transcripts and clear the buffer."""
        drained = self._pending
        self._pending = []
        return drained

    def has_pending(self) -> bool:
        return bool(self._pending)

    # -- utterance-end signal (Fase C) -------------------------------

    def signal_utterance_end(self) -> None:
        """Fire the UtteranceEnd event so any awaiting coalesce_node
        breaks out of its wall-clock sleep early.

        Called by the rt_go WS handler when Deepgram tells us "the
        speaker finished talking" via the utterance_end message type.
        Safe to call when no one is waiting (the event simply stays set
        until the NEXT ``wait_for_utterance_end`` clears it)."""
        self._utterance_end_event.set()

    async def wait_for_utterance_end(self, timeout: float) -> bool:
        """Wait up to ``timeout`` seconds for the UtteranceEnd signal.

        Returns True if the signal fired (early exit), False on timeout
        (fallback to wall clock).

        IMPORTANT: the event is RESET at the START of the call so stale
        signals from a prior turn (or from outside any coalesce window)
        cannot trigger an immediate exit on this turn. The window is
        always at least ONE event firing wide."""
        # Reset so this call only sees signals that arrive AFTER it.
        self._utterance_end_event.clear()
        try:
            await asyncio.wait_for(
                self._utterance_end_event.wait(), timeout=timeout,
            )
            return True
        except asyncio.TimeoutError:
            return False

    # -- screen OCR text (G2) ----------------------------------------

    def set_screen_text(
        self,
        *,
        text: str,
        confidence: float,
        captured_at_ms: int,
    ) -> None:
        """Store the latest OCR extraction from the web client.

        Idempotent: every call overwrites the slot. Empty / whitespace
        text CLEARS the slot so we don't keep serving a stale extraction
        when the user switches tabs to a blank page. We do NOT history-
        track screen text — the LLM only ever sees the most recent
        extraction and the freshness gate lives in ``get_screen_text``.
        """
        if not text or not text.strip():
            self._screen_text = ""
            self._screen_text_confidence = 0.0
            self._screen_text_captured_at_ms = 0
            return
        self._screen_text = text.strip()
        self._screen_text_confidence = confidence
        self._screen_text_captured_at_ms = captured_at_ms

    def get_screen_text(
        self,
        *,
        min_confidence: float = SCREEN_TEXT_MIN_CONFIDENCE,
        stale_window_seconds: float = SCREEN_TEXT_STALE_WINDOW_SECONDS,
        max_chars: int = SCREEN_TEXT_MAX_CHARS,
    ) -> Optional[str]:
        """Return the most recent screen text IFF it is fresh and
        confident enough; otherwise ``None``.

        Filters:
          * empty slot           → None
          * confidence below min → None (OCR noise)
          * older than window    → None (stale — the user moved on)

        On success, truncates to ``max_chars`` (with a trailing ``…``
        sentinel) so the system prompt cannot be ballooned by huge
        screens. The prompt builder consumes this directly.
        """
        if not self._screen_text:
            return None
        if self._screen_text_confidence < min_confidence:
            return None
        now_ms = int(time.time() * 1000)
        age_seconds = (now_ms - self._screen_text_captured_at_ms) / 1000.0
        if age_seconds > stale_window_seconds:
            return None
        if len(self._screen_text) > max_chars:
            return self._screen_text[: max_chars - 1] + "…"
        return self._screen_text

    # -- lock --------------------------------------------------------

    @property
    def lock(self) -> asyncio.Lock:
        """Use this lock around ``cancel_in_flight``+``add_pending``
        sequences to avoid losing a transcript to a race with the
        coalesce node."""
        return self._lock


class SessionStateRegistry:
    """Singleton lookup ``session_id -> SessionConversationState``.

    Lazy-creates state on first access (mirroring how
    ``BehaviorRegistry`` exposes a default). Provides ``pop`` for cleanup
    when the WebSocket disconnects.

    NOTE: in-memory only. A multi-instance deployment will need a
    distributed coordinator (Redis/etc.) — out of scope for Fase B."""

    def __init__(self, *, history_limit: int = 3) -> None:
        self._states: dict[str, SessionConversationState] = {}
        self._history_limit = history_limit
        self._lock = asyncio.Lock()

    def get(self, session_id: str) -> SessionConversationState:
        """Get-or-create the state object for a session. Sync because
        the underlying ``dict`` insert is atomic in CPython — only the
        async ``lock`` protects the COMBINATION of cancel + add_pending."""
        state = self._states.get(session_id)
        if state is None:
            state = SessionConversationState(history_limit=self._history_limit)
            self._states[session_id] = state
            _logger.info(
                "[SessionStateRegistry] Created state for session=%s "
                "(history_limit=%d)", session_id, self._history_limit,
            )
        return state

    def pop(self, session_id: str) -> Optional[SessionConversationState]:
        """Remove a session's state (e.g. on disconnect)."""
        state = self._states.pop(session_id, None)
        if state is not None:
            _logger.info(
                "[SessionStateRegistry] Removed state for session=%s",
                session_id,
            )
            # Best-effort cancel of any leftover in-flight task.
            state.cancel_in_flight()
        return state

    def list_session_ids(self) -> list[str]:
        return list(self._states.keys())
