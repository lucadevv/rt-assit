"""meeting_business — executive / business meeting behavior.

Medium filler set that ALSO swallows greetings ("hola", "buenas") —
in an executive meeting, greetings are brief courtesy that doesn't
demand a substantive response from the assistant. Only meaningful
contributions trigger LLM. (`proactive_greeting=False` is the matching
policy declaration.)
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


class MeetingBusinessBehavior:
    scenario_id = "meeting_business"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1200

    def proactive_greeting(self) -> bool:
        return False  # executive courtesy — greetings don't require a turn

    def max_response_tokens(self) -> int:
        # Fase D.1 — bumped 180 -> 300 to absorb the unavoidable thinking
        # trace gpt-oss emits even when reasoning is disabled. The 180
        # cap forced a salvage retry on every call and DOUBLED latency.
        # Observed visible answer is still 70-100 chars; the extra
        # budget is for the model's internal trace.
        return 300

    def min_confidence(self) -> float:
        # Executive meeting — moderate threshold; participants tend to
        # speak clearly but conference rooms have background noise.
        return 0.5

    def reasoning_effort(self) -> Optional[str]:
        # Disabled — executive register is fast and to the point.
        # (gpt-oss honours this partially; see comment on max_response_tokens.)
        return None
