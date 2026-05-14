"""List all registered scenarios."""
from app.application.ports.scenario_repository import ScenarioRepository
from app.domain.entities.scenario import Scenario


class ListScenariosUseCase:
    def __init__(self, scenarios_repo: ScenarioRepository) -> None:
        self.scenarios_repo = scenarios_repo

    def execute(self) -> list[Scenario]:
        return self.scenarios_repo.list()
