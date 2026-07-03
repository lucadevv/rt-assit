"""Scenarios REST endpoint — thin layer over ListScenariosUseCase."""
from fastapi import APIRouter, Depends

from app.application.use_cases.list_scenarios import ListScenariosUseCase
from app.presentation.api.schemas import ScenarioSummary
from app.presentation.deps import get_list_scenarios_use_case


router = APIRouter()


@router.get("/api/scenarios", response_model=list[ScenarioSummary])
async def list_available_scenarios(
    dev_only: bool = False,
    use_case: ListScenariosUseCase = Depends(get_list_scenarios_use_case),
) -> list[ScenarioSummary]:
    scenarios = use_case.execute()
    if dev_only:
        scenarios = [s for s in scenarios if s.is_dev_focused]
    return [
        ScenarioSummary(
            id=s.id,
            label=s.label,
            doc_types=s.relevant_doc_types,
            description=s.description,
            color=s.color,
            is_dev_focused=s.is_dev_focused,
        )
        for s in scenarios
    ]
