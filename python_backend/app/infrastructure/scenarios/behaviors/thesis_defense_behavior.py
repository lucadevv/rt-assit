"""thesis_defense — thesis defense / dissertation viva behavior.

Broad filler set including "hola" — thesis defense is highly formal and
extended, the student waits silently for substantive questions from
the jury.
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


class ThesisDefenseBehavior:
    scenario_id = "thesis_defense"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1800  # jury questions can be long, allow batching

    def proactive_greeting(self) -> bool:
        return False

    def max_response_tokens(self) -> int:
        # Fase D right-sizing: rigorous, may need a chapter ref. Observed avg 205.
        return 400

    def min_confidence(self) -> float:
        # Thesis defense — STRICT threshold. Jury questions are precise
        # and citation-laden; mis-hearing a methodology question is a
        # career-stage risk. Force the user to repeat low-confidence input.
        return 0.6

    def reasoning_effort(self) -> Optional[str]:
        # Rigorous academic register — keep reasoning on at "low".
        return "low"
