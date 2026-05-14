"""interview_dev — technical job interview behavior.

Candidate is NOT speaking — interviewer is. Filler words like "hola",
"ok", "claro" come from the interviewer and must be skipped (the
candidate doesn't reply to small talk). Single-word imperatives
("Preséntate", "Cuéntame") DO trigger a response.
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


class InterviewDevBehavior:
    scenario_id = "interview_dev"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        # Min 1 word — single-word imperatives like "Preséntate" pass.
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1500  # interview cadence is slower

    def proactive_greeting(self) -> bool:
        return False  # candidate doesn't say "hola" when interviewer says it

    def max_response_tokens(self) -> int:
        # Fase D right-sizing: observed avg 119 tk, cap at p95*1.5 ≈ 250.
        return 250

    def min_confidence(self) -> float:
        # Technical interview — moderate threshold. Jargon-heavy speech
        # gets harder STT scores, so 0.5 is the sweet spot between
        # gating noise and letting legitimate technical terms through.
        return 0.5

    def reasoning_effort(self) -> Optional[str]:
        # Technical interview answers benefit from some structure — keep
        # reasoning on at "low" for balanced TTFT vs depth.
        return "low"
