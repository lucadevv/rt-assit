"""interview_behavioral — behavioral/soft-skills job interview behavior.

Same skip-fillers pattern as interview_dev but with a slightly larger
token budget for longer narrative answers (STAR-style stories).
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


class InterviewBehavioralBehavior:
    scenario_id = "interview_behavioral"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1500

    def proactive_greeting(self) -> bool:
        return False

    def max_response_tokens(self) -> int:
        # Fase D right-sizing: STAR stories need space, observed avg 174;
        # cap at 350 keeps generous headroom without being wasteful.
        return 350

    def min_confidence(self) -> float:
        # Behavioral interview — same threshold as the technical track;
        # the interviewer's voice profile is the same regardless of topic.
        return 0.5

    def reasoning_effort(self) -> Optional[str]:
        # STAR-style narrative benefits from light reasoning.
        return "low"
