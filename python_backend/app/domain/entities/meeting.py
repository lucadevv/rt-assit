"""Meeting — provider-agnostic meeting entity (Meeting Frame, Sprint 1+).

Created via a provider-specific service (``MeetProvider`` for Google Meet,
``TeamsProvider`` / ``ZoomProvider`` in Sprints 2/3). The entity itself stays
provider-agnostic and only carries the user-visible shape."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal


MeetingProvider = Literal["meet", "zoom", "teams"]


@dataclass(frozen=True)
class Meeting:
    id: str
    user_id: str
    provider: MeetingProvider
    join_url: str
    provider_meeting_id: str  # e.g. "spaces/abc123" for Meet
    title: str | None
    created_at: int  # epoch ms
