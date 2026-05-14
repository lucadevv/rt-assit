"""Atomic usage increments (B5 — Billing).

Each "Increment*" use case is a thin wrapper around UsageRepository.atomic_increment.
The use cases are intentionally small classes (vs functions) to match the rest
of the codebase's class-with-execute() pattern."""
from __future__ import annotations

from app.application.ports.usage_repository import UsageRepository
from app.application.services.billing_periods import current_month_period
from app.domain.entities.usage_record import UsageRecord


class _BaseIncrement:
    field: str = ""

    def __init__(self, repo: UsageRepository) -> None:
        self.repo = repo

    def _execute(self, *, user_id: str, delta: int) -> UsageRecord:
        period_start, period_end = current_month_period()
        return self.repo.atomic_increment(
            user_id=user_id,
            period_start=period_start,
            period_end=period_end,
            field=self.field,
            delta=delta,
        )


class IncrementMinutesUsedUseCase(_BaseIncrement):
    field = "minutes_used"

    def execute(self, *, user_id: str, minutes: int = 1) -> UsageRecord:
        return self._execute(user_id=user_id, delta=minutes)


class IncrementSessionsCountUseCase(_BaseIncrement):
    field = "sessions_count"

    def execute(self, *, user_id: str, delta: int = 1) -> UsageRecord:
        return self._execute(user_id=user_id, delta=delta)


class IncrementSessionsCompletedUseCase(_BaseIncrement):
    field = "sessions_completed"

    def execute(self, *, user_id: str, delta: int = 1) -> UsageRecord:
        return self._execute(user_id=user_id, delta=delta)


class IncrementDocsCountUseCase(_BaseIncrement):
    field = "docs_count"

    def execute(self, *, user_id: str, delta: int = 1) -> UsageRecord:
        return self._execute(user_id=user_id, delta=delta)


class IncrementLLMTokensUseCase:
    def __init__(self, repo: UsageRepository) -> None:
        self.repo = repo

    def execute(
        self, *, user_id: str, input_tokens: int, output_tokens: int
    ) -> None:
        period_start, period_end = current_month_period()
        if input_tokens > 0:
            self.repo.atomic_increment(
                user_id=user_id,
                period_start=period_start,
                period_end=period_end,
                field="llm_input_tokens",
                delta=input_tokens,
            )
        if output_tokens > 0:
            self.repo.atomic_increment(
                user_id=user_id,
                period_start=period_start,
                period_end=period_end,
                field="llm_output_tokens",
                delta=output_tokens,
            )


class IncrementSttSecondsUseCase(_BaseIncrement):
    field = "stt_audio_seconds"

    def execute(self, *, user_id: str, seconds: int) -> UsageRecord:
        return self._execute(user_id=user_id, delta=seconds)
