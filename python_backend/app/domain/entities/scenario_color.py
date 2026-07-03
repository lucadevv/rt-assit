"""Scenario -> semantic color mapping (B3).

Pure domain logic — no framework. Frontend resolves the semantic color
name to actual hex/oklch values via its design tokens. We keep the
mapping in the domain layer because the *meaning* (e.g. interview = cyan,
client = amber) is a product decision, not a UI/transport concern.
"""
from typing import Final


# Maps scenario id -> semantic color name (frontend resolves to actual hex)
SCENARIO_COLORS: Final[dict[str, str]] = {
    "interview_dev": "cyan",
    "interview_behavioral": "cyan",
    "technical_call": "amber",
    "code_review": "lime",
    "meeting_business": "amber",
    "client_call": "amber",
    "sales_call": "amber",
    "exam_oral": "lavender",
    "thesis_defense": "lavender",
    "legal_client_call": "lavender",
    "legal_negotiation": "amber",
    "legal_hearing": "cyan",
    "personal": "lime",
    "default": "lime",
}


def get_scenario_color(scenario_id: str | None) -> str:
    """Return the semantic color name for a scenario.

    Frontend resolves the semantic name (cyan / amber / lavender / lime)
    to actual hex/oklch via its design system tokens. Falls back to the
    ``default`` color when the scenario id is unknown or empty."""
    if not scenario_id:
        return SCENARIO_COLORS["default"]
    return SCENARIO_COLORS.get(scenario_id, SCENARIO_COLORS["default"])
