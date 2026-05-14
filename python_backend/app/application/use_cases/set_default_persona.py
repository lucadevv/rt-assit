"""Promote a persona to the user's default."""
from __future__ import annotations

from app.application.ports.personas_repository import PersonasRepository
from app.domain.entities.persona import Persona
from app.domain.exceptions import NotFoundError


class SetDefaultPersonaUseCase:
    def __init__(self, repo: PersonasRepository) -> None:
        self.repo = repo

    def execute(self, *, persona_id: int, user_id: str) -> Persona:
        try:
            return self.repo.set_default(persona_id, user_id=user_id)
        except NotFoundError:
            raise
