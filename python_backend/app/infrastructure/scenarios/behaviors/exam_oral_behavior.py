"""exam_oral — academic oral exam behavior.

Broad filler set that ALSO swallows greetings — academic formal
register: the examiner's greeting doesn't demand a turn from the
student. Only actual questions trigger LLM. (`proactive_greeting=False`
is the matching policy declaration.)
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


class ExamOralBehavior:
    scenario_id = "exam_oral"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1500

    def proactive_greeting(self) -> bool:
        return False  # academic formal — no greeting response

    def max_response_tokens(self) -> int:
        # Fase D right-sizing: academic but concise, observed avg 170.
        return 300

    def min_confidence(self) -> float:
        # Oral exam — STRICT threshold. Academic precision matters more
        # than coverage; answering the wrong question is worse than
        # silently asking the examiner to repeat. Same as thesis_defense.
        return 0.6

    def reasoning_effort(self) -> Optional[str]:
        # Academic answers benefit from light reasoning.
        return "low"
