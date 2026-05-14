"""Background-job tracking use cases (B8).

Bundle of small CRUD-ish use cases (create, list, mark running/completed/
failed). Combined into one module to keep the application layer
manageable; each public class is independently testable."""
from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from app.application.ports.background_jobs_repository import (
    BackgroundJobsRepository,
)
from app.domain.entities.background_job import (
    BackgroundJob,
    VALID_JOB_STATUSES,
    VALID_JOB_TYPES,
)
from app.domain.exceptions import NotFoundError, ValidationError


class CreateBackgroundJobUseCase:
    def __init__(self, repo: BackgroundJobsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        type: str,
        payload: Optional[dict[str, Any]] = None,
        max_attempts: int = 3,
        scheduled_at: Optional[datetime] = None,
        job_id: Optional[str] = None,
    ) -> BackgroundJob:
        if type not in VALID_JOB_TYPES:
            raise ValidationError(f"Tipo de job inválido: {type}")
        if max_attempts < 1:
            raise ValidationError("max_attempts debe ser >= 1")

        job = BackgroundJob(
            id=job_id or str(uuid.uuid4()),
            type=type,  # type: ignore[arg-type]
            payload=payload or {},
            status="pending",
            attempts=0,
            max_attempts=max_attempts,
            scheduled_at=scheduled_at,
            created_at=datetime.now(timezone.utc),
        )
        return self.repo.create(job)


class ListBackgroundJobsUseCase:
    def __init__(self, repo: BackgroundJobsRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        status: Optional[str] = None,
        type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[BackgroundJob]:
        if status is not None and status not in VALID_JOB_STATUSES:
            raise ValidationError(f"Estado de job inválido: {status}")
        if type is not None and type not in VALID_JOB_TYPES:
            raise ValidationError(f"Tipo de job inválido: {type}")
        if limit < 1:
            limit = 1
        if limit > 500:
            limit = 500
        if offset < 0:
            offset = 0
        return self.repo.list_jobs(
            status=status, type=type, limit=limit, offset=offset
        )


class MarkJobRunningUseCase:
    def __init__(self, repo: BackgroundJobsRepository) -> None:
        self.repo = repo

    def execute(self, *, job_id: str) -> None:
        if self.repo.get(job_id) is None:
            raise NotFoundError("Job no encontrado")
        self.repo.mark_running(job_id)


class MarkJobCompletedUseCase:
    def __init__(self, repo: BackgroundJobsRepository) -> None:
        self.repo = repo

    def execute(self, *, job_id: str) -> None:
        if self.repo.get(job_id) is None:
            raise NotFoundError("Job no encontrado")
        self.repo.mark_completed(job_id)


class MarkJobFailedUseCase:
    def __init__(self, repo: BackgroundJobsRepository) -> None:
        self.repo = repo

    def execute(self, *, job_id: str, error: str) -> None:
        if self.repo.get(job_id) is None:
            raise NotFoundError("Job no encontrado")
        self.repo.mark_failed(job_id, error)
