"""List plans — public catalog use case."""
from __future__ import annotations

from app.application.ports.plans_repository import PlansRepository
from app.domain.entities.plan import Plan


class ListPlansUseCase:
    def __init__(self, plans_repo: PlansRepository) -> None:
        self.plans_repo = plans_repo

    def execute(self) -> list[Plan]:
        return self.plans_repo.list_active()


class GetPlanByCodeUseCase:
    def __init__(self, plans_repo: PlansRepository) -> None:
        self.plans_repo = plans_repo

    def execute(self, *, code: str, billing_cycle: str = "monthly") -> Plan | None:
        return self.plans_repo.get_by_code(code, billing_cycle=billing_cycle)


class GetPlanByIdUseCase:
    def __init__(self, plans_repo: PlansRepository) -> None:
        self.plans_repo = plans_repo

    def execute(self, *, plan_id: str) -> Plan | None:
        return self.plans_repo.get_by_id(plan_id)
