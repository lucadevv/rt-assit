"""Repository port for scenarios."""
from abc import ABC, abstractmethod

from app.domain.entities.scenario import Scenario


class ScenarioRepository(ABC):
    """Abstract scenarios registry."""

    @abstractmethod
    def get(self, scenario_id: str) -> Scenario:
        """Fetch a scenario by id, with fallback behaviour defined by impl."""
        ...

    @abstractmethod
    def list(self) -> list[Scenario]:
        """List all registered scenarios."""
        ...

    @abstractmethod
    def register(self, scenario: Scenario) -> None:
        """Register a new scenario."""
        ...
