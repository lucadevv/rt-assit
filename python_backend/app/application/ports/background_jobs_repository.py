"""Repository port for background-job tracking (B8)."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.background_job import BackgroundJob


class BackgroundJobsRepository(ABC):
    @abstractmethod
    def create(self, job: BackgroundJob) -> BackgroundJob:
        ...

    @abstractmethod
    def get(self, job_id: str) -> Optional[BackgroundJob]:
        ...

    @abstractmethod
    def list_jobs(
        self,
        *,
        status: Optional[str] = None,
        type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[BackgroundJob]:
        ...

    @abstractmethod
    def mark_running(self, job_id: str) -> None:
        ...

    @abstractmethod
    def mark_completed(self, job_id: str) -> None:
        ...

    @abstractmethod
    def mark_failed(self, job_id: str, error: str) -> None:
        ...

    @abstractmethod
    def increment_attempts(self, job_id: str) -> int:
        """Return the new attempt count."""
        ...
