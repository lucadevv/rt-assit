"""Repository port for integrations persistence (B4 placeholder).

Only read operations are defined for now — connect/disconnect/upsert
flows arrive when OAuth is implemented (F-future). The placeholder
endpoint GET /api/integrations relies solely on ``list_for_user``.
"""
from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.integration import Integration


class IntegrationsRepository(ABC):
    """Abstract integrations store. Multi-tenant via ``user_id``."""

    @abstractmethod
    def list_for_user(self, user_id: str) -> list[Integration]:
        """Return all integrations for a user (empty list if none)."""
        ...

    @abstractmethod
    def get_by_provider(
        self, user_id: str, provider: str
    ) -> Optional[Integration]:
        """Return the integration for ``(user_id, provider)`` or None."""
        ...
