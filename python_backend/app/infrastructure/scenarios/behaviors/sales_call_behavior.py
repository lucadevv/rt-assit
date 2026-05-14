"""sales_call — outbound/inbound sales call behavior.

Tiny filler set — sales etiquette demands responding to almost anything,
including greetings AND objections. Only true back-channel noise is
skipped.
"""
from __future__ import annotations

from typing import Optional

from app.infrastructure.scenarios.behaviors._base import is_in_set, word_count


_FILLERS: set[str] = {"mhm", "ajá", "aja", "uhum"}


class SalesCallBehavior:
    scenario_id = "sales_call"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1800  # sales likes slightly longer batches (objection chains)

    def proactive_greeting(self) -> bool:
        return True

    def max_response_tokens(self) -> int:
        # Fase D right-sizing: objection handling, observed avg 90.
        return 300

    def min_confidence(self) -> float:
        # Sales call — same as client_call. Phone audio is noisy and
        # missing an objection is a deal-killer; we'd rather over-respond
        # to a moderate-confidence transcript than stay silent.
        return 0.4

    def reasoning_effort(self) -> Optional[str]:
        # Reasoning helps with objection structure.
        return "low"
