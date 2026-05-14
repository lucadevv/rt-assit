"""client_call — account-manager call with a client.

Small filler set (mostly back-channel "mhm" / "ajá"). Account-manager
etiquette: ALWAYS respond to a "hola" / "buenas" from the client.
"""
from __future__ import annotations

from typing import Optional

from app.infrastructure.scenarios.behaviors._base import is_in_set, word_count


_FILLERS: set[str] = {"mhm", "ajá", "aja", "uhum", "ok"}


class ClientCallBehavior:
    scenario_id = "client_call"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1200

    def proactive_greeting(self) -> bool:
        return True  # courtesy etiquette — respond to greetings

    def max_response_tokens(self) -> int:
        # Fase D.1 — bumped 180 -> 300 to absorb the always-emitted
        # thinking trace (gpt-oss). 180 was starving content and forcing
        # the salvage retry on every call. Visible answer is still
        # short (~60 chars); the extra budget is internal-trace ceiling.
        return 300

    def min_confidence(self) -> float:
        # Client call — permissive threshold. Phone/VoIP audio quality
        # is often poor, but missing a client's question is worse than
        # responding to a noisy one. Trust the courtesy etiquette.
        return 0.4

    def reasoning_effort(self) -> Optional[str]:
        # Disabled — account-manager replies are fast and conversational.
        return None
