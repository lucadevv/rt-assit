"""ScenarioBehavior — per-scenario decision policy for the live agent.

Each scenario provides a behavior implementation that decides:
  - Whether a given transcript should trigger an LLM response.
  - How long to wait before processing (debounce coalesce window).
  - Whether proactive greetings are allowed.
  - The visible-content token budget (max_response_tokens).
  - The reasoning effort to use for this scenario (None disables reasoning).

Pure domain — NO framework imports, NO infrastructure. The concrete
implementations live in `infrastructure/scenarios/behaviors/`.
"""
from __future__ import annotations

from typing import Optional, Protocol


class ScenarioBehavior(Protocol):
    """Per-scenario policy for the live agent's response decisions."""

    @property
    def scenario_id(self) -> str:
        """The scenario this behavior belongs to (e.g. 'interview_dev')."""
        ...

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        """Decide whether the given transcript warrants an LLM response.

        `history` is the recent transcript history (last N finals) for
        coalescing-aware decisions. Implementations can ignore it.

        Return True to trigger LLM. False to skip (no response generated).
        """
        ...

    def coalesce_window_ms(self) -> int:
        """Ms to wait after a `final` transcript before generating, so
        a follow-up transcript within the window can be batched in.
        Used in Fase B (LangGraph coalescing). Strategies declare it now
        so the contract is complete from the start.
        """
        ...

    def proactive_greeting(self) -> bool:
        """If True, respond to greetings like 'hola' / 'buenas'.
        If False, treat them as fillers."""
        ...

    def max_response_tokens(self) -> int:
        """Soft cap on response length (token budget)."""
        ...

    def min_confidence(self) -> float:
        """Minimum Deepgram confidence (0.0–1.0) to trigger LLM response.

        When a transcript arrives with ``0.0 < confidence < min_confidence()``,
        the graph skips the LLM call and emits a WS ``unclear`` event so the
        UI can prompt the user to repeat. ``confidence == 0.0`` is treated
        as "no data" (Deepgram occasionally emits zero for finals it can't
        score) and is NOT gated — we only gate KNOWN-low-confidence input.

        Range guidance:
          * 0.0 disables gating (legacy / no policy)
          * 0.3 permissive (casual scenarios)
          * 0.6 strict (academic / high-precision scenarios)
        """
        ...

    def reasoning_effort(self) -> Optional[str]:
        """Reasoning effort to use for this scenario.

        Values:
          - "low"  — balanced (default for scenarios that need a bit
            of thought, e.g. technical interview, exam, thesis).
          - "medium" / "high" — slower, more thoughtful. Reserved.
          - None — disable reasoning entirely (no thinking trace),
            fastest TTFT. Used for casual scenarios.

        IMPORTANT: returning ``None`` means the caller MUST explicitly
        disable reasoning on the LLM client for this call. Use a sentinel
        in the client layer to differentiate "caller didn't say" from
        "caller wants reasoning OFF".
        """
        ...
