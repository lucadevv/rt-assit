"""Scenario configuration entity."""
from dataclasses import dataclass


@dataclass
class Scenario:
    """A scenario binds an agent persona to relevant doc_types and a user template.

    Pure config dataclass — no framework dependencies.

    Fields:
        id: stable slug (e.g. ``interview_dev``).
        label: short human-readable name (Spanish, shown in UI tabs/badges).
        description: ~1-line UI description (Spanish).
        persona_system: system prompt template — uses placeholders that
            ``PromptBuilder`` fills (``{candidate_name}``, ``{identity_docs}``,
            ``{scenario_docs}``, ``{reference_docs}``, plus any
            scenario-specific tokens).
        relevant_doc_types: doc_types that the prompt builder pulls into
            this scenario's context. Single source of truth for which docs
            are surfaced.
        user_template: per-turn user prompt template — receives transcript
            history (``{n_questions}``, ``{past_questions}``, ``{n_hints}``,
            ``{past_hints}``, ``{current_transcript}``).
        color: semantic color name (e.g. ``cyan``, ``amber``). Frontend
            resolves to actual hex/oklch via design tokens. See
            ``app.domain.entities.scenario_color``.
    """

    id: str
    label: str
    persona_system: str
    relevant_doc_types: list[str]
    user_template: str
    description: str = ""
    color: str = "lime"
