"""Shared internals for ScenarioBehavior implementations.

Pure stdlib — re only — so the base class can live in infrastructure
without violating layering (it implements a domain Protocol, doesn't
import frameworks).
"""
from __future__ import annotations

import re


_PUNCTUATION_RE = re.compile(r"[¿?¡!,.;:]")


# Transition / hesitation words that NEVER carry a question on their own,
# regardless of scenario. Used by formal-tone behaviors (interview, exam,
# meeting, thesis) as a shared set. Casual scenarios (personal, sales,
# client_call) override or skip this set per their own policy.
TRANSITION_FILLERS: set[str] = {
    "ahora", "entonces", "este", "esto", "pues", "a ver", "veamos",
    "bueno", "mira", "mirá", "eh", "em", "emm", "ehh",
    "digamos", "qué sé yo", "qué se yo", "o sea", "tipo",
}


def normalize(transcript: str) -> str:
    """Lower-case, strip punctuation, trim whitespace."""
    return _PUNCTUATION_RE.sub("", transcript).strip().lower()


def is_in_set(transcript: str, fillers: set[str]) -> bool:
    """True if the normalized transcript exactly matches a filler."""
    return normalize(transcript) in fillers


def word_count(transcript: str) -> int:
    """Word count after normalization."""
    return len(normalize(transcript).split())
