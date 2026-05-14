"""ScenarioBehavior registry — resolves the policy for a given scenario.

Indexed at construction time so resolution is O(1) per transcript.
Falls back to a generic "respond to anything non-empty" default for
unknown scenarios so the system fails open (no transcript is silently
dropped without explanation).
"""
from __future__ import annotations

import logging

from app.domain.services.scenario_behavior import ScenarioBehavior


_logger = logging.getLogger(__name__)


class _DefaultBehavior:
    """Permissive fallback for scenarios that haven't registered a behavior.

    Returns True for any non-empty transcript so the user notices unmapped
    scenarios via excessive responses rather than silent skipping."""
    scenario_id = "_default"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        return bool(transcript and transcript.strip())

    def coalesce_window_ms(self) -> int:
        return 1500

    def proactive_greeting(self) -> bool:
        return True

    def max_response_tokens(self) -> int:
        return 350


class BehaviorRegistry:
    """O(1) scenario_id -> ScenarioBehavior lookup."""

    def __init__(self, behaviors: list[ScenarioBehavior]) -> None:
        self._by_id: dict[str, ScenarioBehavior] = {
            b.scenario_id: b for b in behaviors
        }
        self._default = _DefaultBehavior()

    def get(self, scenario_id: str) -> ScenarioBehavior:
        b = self._by_id.get(scenario_id)
        if b is None:
            _logger.warning(
                "[BehaviorRegistry] No behavior for scenario_id=%r — using default.",
                scenario_id,
            )
            return self._default
        return b

    def list_ids(self) -> list[str]:
        return list(self._by_id.keys())
