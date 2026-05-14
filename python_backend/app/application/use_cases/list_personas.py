"""List personas for a user."""
from __future__ import annotations

from app.application.ports.personas_repository import PersonasRepository
from app.domain.entities.persona import Persona


class ListPersonasUseCase:
    def __init__(self, repo: PersonasRepository) -> None:
        self.repo = repo

    def execute(self, *, user_id: str) -> list[Persona]:
        return self.repo.list_for_user(user_id)
