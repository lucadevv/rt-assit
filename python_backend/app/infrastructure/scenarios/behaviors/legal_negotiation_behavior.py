"""legal_negotiation — B2B contract negotiation behavior.

Broad filler set including "hola" — executive negotiation register:
greetings are brief courtesy that doesn't demand a substantive answer.
Only meaningful proposals, objections, or questions trigger LLM.
(`proactive_greeting=False` is the matching policy declaration.)
"""
from __future__ import annotations

from typing import Optional

from app.infrastructure.scenarios.behaviors._base import (
    TRANSITION_FILLERS,
    is_in_set,
    word_count,
)


_FILLERS: set[str] = TRANSITION_FILLERS | {
    "ok", "okey", "okay", "vale", "claro", "perfecto", "buenisimo", "buenísimo",
    "aja", "ajá", "mhm", "uhum", "exacto", "tal cual",
    "si", "sí", "no", "ya", "dale", "listo", "gracias", "muchas gracias",
    "hola", "buenas", "buen día", "buenas tardes", "buenas noches",
    "qué tal", "cómo estás", "cómo va",
}


class LegalNegotiationBehavior:
    scenario_id = "legal_negotiation"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1500  # negotiation turns can be long, allow batching

    def proactive_greeting(self) -> bool:
        return False  # executive courtesy — greetings don't require a turn

    def max_response_tokens(self) -> int:
        # Contract argument needs clauses + rationale; 3-5 sentences
        # (~300-450 chars visible) plus internal trace budget.
        return 450

    def min_confidence(self) -> float:
        # Negotiation — moderate threshold. Counterparty speaks clearly
        # but legal/commercial terms are dense; 0.5 is the sweet spot.
        return 0.5

    def reasoning_effort(self) -> Optional[str]:
        # Contractual answers benefit from light structured reasoning.
        return "low"
