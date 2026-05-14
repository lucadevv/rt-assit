"""Re-run summary generation for a session whose summary already exists (B2).

Thin wrapper around ``GenerateSessionSummaryUseCase`` — kept as its own
use case so the router has a stable, intent-revealing entry point and so
future variants (e.g. force-strategy=brief vs detailed) can plug in here
without changing the LLM call site."""
from app.application.use_cases.generate_session_summary import (
    GenerateSessionSummaryUseCase,
)
from app.domain.entities.session import Session


class RegenerateSummaryUseCase:
    def __init__(self, generate: GenerateSessionSummaryUseCase) -> None:
        self.generate = generate

    async def execute(self, *, session_id: str, user_id: str) -> Session:
        return await self.generate.execute(session_id=session_id, user_id=user_id)
