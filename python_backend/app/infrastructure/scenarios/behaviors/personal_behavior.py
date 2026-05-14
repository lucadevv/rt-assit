"""personal — personal assistant / chat companion behavior.

Tiny filler set — the assistant should respond to almost anything,
INCLUDING greetings ("hola" -> "¡Hola! ¿En qué te ayudo?"). Only true
back-channel noise like "mhm" / "ajá" is skipped.
"""
from __future__ import annotations

from typing import Optional

from app.infrastructure.scenarios.behaviors._base import is_in_set, word_count


_FILLERS: set[str] = {"mhm", "ajá", "aja", "uhum"}


class PersonalBehavior:
    scenario_id = "personal"

    def should_respond(self, transcript: str, history: list[str]) -> bool:
        if not transcript or not transcript.strip():
            return False
        if is_in_set(transcript, _FILLERS):
            return False
        return word_count(transcript) >= 1

    def coalesce_window_ms(self) -> int:
        return 800  # snappy assistant cadence

    def proactive_greeting(self) -> bool:
        return True

    def max_response_tokens(self) -> int:
        # Fase D.1 — bumped from 120 -> 300 to give the model headroom
        # for its ALWAYS-emitted thinking trace (gpt-oss ignores `think:
        # false`). A 120 cap caused the thinking to eat the whole budget
        # and forced a salvage retry — doubling latency. Observed avg
        # response is still ~34 chars; 300 just guarantees content gets
        # a budget slice even when the model emits 150-200 thinking tk.
        return 300

    def min_confidence(self) -> float:
        # Personal assistant — MOST permissive threshold. Casual chat
        # tolerates noisy input ("¿qué dijiste?"-style follow-ups are
        # cheap); the assistant should err on the side of responding.
        return 0.3

    def reasoning_effort(self) -> Optional[str]:
        # Disabled — casual chat should be fastest. (gpt-oss still emits
        # SOME thinking even with this flag, but quantitatively less,
        # which is why the bumped cap above is enough now.)
        return None
