"""Update a persona (partial). Only fields provided are mutated."""
from __future__ import annotations

from typing import Optional

from app.application.ports.personas_repository import PersonasRepository
from app.domain.entities.persona import Persona, PersonaTone
from app.domain.exceptions import NotFoundError, ValidationError


class UpdatePersonaUseCase:
    def __init__(self, repo: PersonasRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        persona_id: int,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        scenario_id: Optional[str] = None,
        icon: Optional[str] = None,
        tone: Optional[PersonaTone] = None,
        custom_instructions: Optional[str] = None,
    ) -> Persona:
        # Validate ownership first — surface NotFound instead of letting
        # the repo update silently.
        existing = self.repo.get(persona_id, user_id=user_id)
        if existing is None:
            raise NotFoundError(f"persona {persona_id} no encontrada")

        if name is not None:
            clean = name.strip()
            if not clean:
                raise ValidationError("el nombre no puede estar vacío")
            if len(clean) > 200:
                raise ValidationError(
                    "el nombre supera los 200 caracteres"
                )
            name = clean

        return self.repo.update(
            persona_id=persona_id,
            user_id=user_id,
            name=name,
            description=description,
            scenario_id=scenario_id,
            icon=icon,
            tone=tone,
            custom_instructions=custom_instructions,
        )
