"""Create a new persona for a user."""
from __future__ import annotations

from typing import Optional

from app.application.ports.personas_repository import PersonasRepository
from app.domain.entities.persona import Persona, PersonaTone
from app.domain.exceptions import ValidationError


class CreatePersonaUseCase:
    def __init__(self, repo: PersonasRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        user_id: str,
        name: str,
        description: Optional[str] = None,
        scenario_id: Optional[str] = None,
        icon: Optional[str] = None,
        tone: Optional[PersonaTone] = None,
        custom_instructions: Optional[str] = None,
        is_default: bool = False,
    ) -> Persona:
        clean_name = (name or "").strip()
        if not clean_name:
            raise ValidationError("el nombre es obligatorio")
        if len(clean_name) > 200:
            raise ValidationError("el nombre supera los 200 caracteres")

        return self.repo.create(
            user_id=user_id,
            name=clean_name,
            description=description,
            scenario_id=scenario_id,
            icon=icon,
            tone=tone,
            custom_instructions=custom_instructions,
            is_default=is_default,
        )
