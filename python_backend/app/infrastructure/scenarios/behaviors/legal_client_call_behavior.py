"""legal_client_call — legal consultation with a client behavior.

Broad filler set including "hola" — formal consultation register: the
lawyer is the professional in the room and answers when the client
makes a substantive ask, but courtesy ("hola", "buenas") DOES warrant
a polite greeting back (client-facing etiquette).
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


class LegalClientCallBehavior:
    scenario_id = "legal_client_call"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 1200  # consult cadence — quick enough to feel natural

    def proactive_greeting(self) -> bool:
        return True  # courtesy with the client — answer "hola" politely

    def max_response_tokens(self) -> int:
        # Legal advice needs 3-5 sentences (~300-450 chars). Budget allows
        # for the visible answer plus the model's internal trace.
        return 400

    def min_confidence(self) -> float:
        # Consultation — moderate threshold. Legal jargon is harder for
        # STT; missing a client's question is worse than acting on a
        # noisy one, but we still want to gate clear noise.
        return 0.5

    def reasoning_effort(self) -> Optional[str]:
        # Legal answers benefit from structured reasoning at "low" —
        # balanced TTFT vs depth, same as other formal scenarios.
        return "low"
