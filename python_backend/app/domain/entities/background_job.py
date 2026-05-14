"""BackgroundJob domain entity (B8 — cross-cutting).

Persistent tracking row for any async unit of work (LLM summary, recording
upload, dunning email, monthly usage reset, …). Lets ops view + retry
failed jobs from /api/admin/jobs and gives B5 cron jobs a paper trail."""
from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Literal, Optional


JobStatus = Literal["pending", "running", "success", "failed", "retrying"]
JobType = Literal[
    "generate_summary",
    "upload_recording",
    "send_email",
    "reset_usage",
    "check_trial_expiration",
    "cleanup_recordings",
    "send_dunning",
    "generic",
]


VALID_JOB_STATUSES: set[str] = {
    "pending",
    "running",
    "success",
    "failed",
    "retrying",
}
VALID_JOB_TYPES: set[str] = {
    "generate_summary",
    "upload_recording",
    "send_email",
    "reset_usage",
    "check_trial_expiration",
    "cleanup_recordings",
    "send_dunning",
    "generic",
}


@dataclass
class BackgroundJob:
    """Track-only entity. Execution still lives on the existing
    AuriScheduler / FastAPI BackgroundTasks pipelines — this row is
    written by callers that want observability + retry support."""

    id: str
    type: JobType
    payload: dict[str, Any] = field(default_factory=dict)
    status: JobStatus = "pending"
    attempts: int = 0
    max_attempts: int = 3
    error: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None
