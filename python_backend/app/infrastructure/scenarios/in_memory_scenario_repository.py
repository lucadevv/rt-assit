"""In-memory scenarios registry. Pre-populated with built-in scenarios."""
from app.application.ports.scenario_repository import ScenarioRepository
from app.domain.entities.scenario import Scenario
from app.infrastructure.scenarios.client_call import build_client_call
from app.infrastructure.scenarios.exam_oral import build_exam_oral
from app.infrastructure.scenarios.interview_behavioral import build_interview_behavioral
from app.infrastructure.scenarios.interview_dev import build_interview_dev
from app.infrastructure.scenarios.legal_client_call import build_legal_client_call
from app.infrastructure.scenarios.legal_hearing import build_legal_hearing
from app.infrastructure.scenarios.legal_negotiation import build_legal_negotiation
from app.infrastructure.scenarios.meeting_business import build_meeting_business
from app.infrastructure.scenarios.personal import build_personal
from app.infrastructure.scenarios.sales_call import build_sales_call
from app.infrastructure.scenarios.thesis_defense import build_thesis_defense


class InMemoryScenarioRepository(ScenarioRepository):
    """Process-local scenarios registry. Built-ins are registered on construction."""

    def __init__(self) -> None:
        self._scenarios: dict[str, Scenario] = {}
        self._register_built_in()

    def _register_built_in(self) -> None:
        # Order here is the natural display order in the UI scenario picker.
        self.register(build_interview_dev())
        self.register(build_interview_behavioral())
        self.register(build_meeting_business())
        self.register(build_client_call())
        self.register(build_sales_call())
        self.register(build_exam_oral())
        self.register(build_thesis_defense())
        self.register(build_legal_client_call())
        self.register(build_legal_negotiation())
        self.register(build_legal_hearing())
        self.register(build_personal())

    def register(self, scenario: Scenario) -> None:
        self._scenarios[scenario.id] = scenario

    def get(self, scenario_id: str) -> Scenario:
        if scenario_id in self._scenarios:
            return self._scenarios[scenario_id]
        fallback = self._scenarios.get("interview_dev")
        if fallback is not None:
            return fallback
        return next(iter(self._scenarios.values()))

    def list(self) -> list[Scenario]:
        return list(self._scenarios.values())
