"""PreMeetingNote domain entity.

Optional AI-generated prep attached to a session BEFORE it starts. Created
by the Pre-Interview Wizard in the NewSessionModal for the interview_dev
and interview_behavioral scenarios. One note per session at most (UNIQUE
constraint on session_id at the SQLite layer).

The two lists are stored separately because they serve different audiences:
- ``probing_questions`` are written in ENGLISH (the interview language)
  and surfaced verbatim to the user.
- ``prep_checklist`` are written in es-LATAM (voseo) and surfaced verbatim
  as well.

Both are LLM-generated; ``raw_user_input`` keeps the original free-text
the user wrote so the note can be regenerated later without losing
context. Pure data — no framework dependencies.
"""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Optional


@dataclass(frozen=True)
class PreMeetingNote:
    id: str
    session_id: str
    user_id: str
    role_target: str
    company_context: str
    job_description: Optional[str]
    probing_questions: tuple[str, ...]
    prep_checklist: tuple[str, ...]
    raw_user_input: str
    created_at: datetime
