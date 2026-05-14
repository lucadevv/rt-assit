"""legal_hearing — court / tribunal hearing behavior.

Broad filler set including "hola" — formal forensic register: the
lawyer waits for substantive prompts from the bench or counterparty.
Procedural greetings don't demand a turn. Stricter min_confidence
than the other legal scenarios because misunderstanding a question
from the tribunal carries higher procedural risk.
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


class LegalHearingBehavior:
    scenario_id = "legal_hearing"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1800  # bench questions can be long, allow batching

    def proactive_greeting(self) -> bool:
        return False  # formal forensic register — no greeting response

    def max_response_tokens(self) -> int:
        # Forensic argument needs citations + factual correlate;
        # 3-5 sentences (~300-450 chars visible) plus trace budget.
        return 500

    def min_confidence(self) -> float:
        # Hearing — STRICT threshold. Misunderstanding a tribunal
        # question is a procedural risk; force the user to repeat
        # low-confidence input, same as exam_oral / thesis_defense.
        return 0.6

    def reasoning_effort(self) -> Optional[str]:
        # Rigorous forensic register — keep reasoning on at "low" for
        # balanced TTFT vs argumentative depth.
        return "low"
