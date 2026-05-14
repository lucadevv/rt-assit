"""Delete a persona scoped to user."""
from __future__ import annotations

from app.application.ports.personas_repository import PersonasRepository
from app.domain.exceptions import NotFoundError


class DeletePersonaUseCase:
    def __init__(self, repo: PersonasRepository) -> None:
        self.repo = repo

    def execute(self, *, persona_id: int, user_id: str) -> None:
        if not self.repo.delete(persona_id, user_id=user_id):
            raise NotFoundError(f"persona {persona_id} no encontrada")
