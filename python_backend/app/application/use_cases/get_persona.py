"""Fetch a single persona, scoped to user."""
from __future__ import annotations

from app.application.ports.personas_repository import PersonasRepository
from app.domain.entities.persona import Persona
from app.domain.exceptions import NotFoundError


class GetPersonaUseCase:
    def __init__(self, repo: PersonasRepository) -> None:
        self.repo = repo

    def execute(self, *, persona_id: int, user_id: str) -> Persona:
        persona = self.repo.get(persona_id, user_id=user_id)
        if persona is None:
            raise NotFoundError(f"persona {persona_id} no encontrada")
        return persona
