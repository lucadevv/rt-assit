"""Scenarios REST endpoint — thin layer over ListScenariosUseCase."""
from fastapi import APIRouter, Depends

from app.application.use_cases.list_scenarios import ListScenariosUseCase
from app.presentation.api.schemas import ScenarioSummary
from app.presentation.deps import get_list_scenarios_use_case


router = APIRouter()


@router.get("/api/scenarios", response_model=list[ScenarioSummary])
async def list_available_scenarios(
    use_case: ListScenariosUseCase = Depends(get_list_scenarios_use_case),
) -> list[ScenarioSummary]:
    scenarios = use_case.execute()
    return [
        ScenarioSummary(
            id=s.id,
            label=s.label,
            doc_types=s.relevant_doc_types,
            description=s.description,
            color=s.color,
        )
        for s in scenarios
    ]
