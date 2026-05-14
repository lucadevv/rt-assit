"""ListIntegrations — return all third-party integrations for a user.

Currently a placeholder: no provider has been connected yet so the list
will be empty for every user. The use case still hits the repository so
that when OAuth flows ship (F-future) the endpoint just works without
touching presentation or composition root.
"""
from app.application.ports.integrations_repository import (
    IntegrationsRepository,
)
from app.domain.entities.integration import Integration


class ListIntegrationsUseCase:
    """Read-only listing of a user's integrations (FR-51 placeholder)."""

    def __init__(self, integrations_repo: IntegrationsRepository) -> None:
        self.integrations_repo = integrations_repo

    def execute(self, *, user_id: str) -> list[Integration]:
        return self.integrations_repo.list_for_user(user_id)
