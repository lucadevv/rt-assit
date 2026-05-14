"""SQLite implementation of BackgroundJobsRepository (B8)."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime
from typing import Any, Optional, cast

from app.application.ports.background_jobs_repository import (
    BackgroundJobsRepository,
)
from app.domain.entities.background_job import (
    BackgroundJob,
    JobStatus,
    JobType,
)
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteBackgroundJobsRepository(BackgroundJobsRepository):
    def create(self, job: BackgroundJob) -> BackgroundJob:
        with get_conn() as conn:
            conn.execute(
                """INSERT INTO background_jobs
                   (id, type, payload, status, attempts, max_attempts,
                    error, scheduled_at, started_at, completed_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    job.id,
                    job.type,
                    json.dumps(job.payload or {}),
                    job.status,
                    job.attempts,
                    job.max_attempts,
                    job.error,
                    _to_iso(job.scheduled_at),
                    _to_iso(job.started_at),
                    _to_iso(job.completed_at),
                ),
            )
            conn.commit()
            row = conn.execute(
                """SELECT id, type, payload, status, attempts, max_attempts,
                          error, scheduled_at, started_at, completed_at,
                          created_at
                   FROM background_jobs WHERE id = ?""",
                (job.id,),
            ).fetchone()
        return self._row_to_entity(row)

    def get(self, job_id: str) -> Optional[BackgroundJob]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT id, type, payload, status, attempts, max_attempts,
                          error, scheduled_at, started_at, completed_at,
                          created_at
                   FROM background_jobs WHERE id = ?""",
                (job_id,),
            ).fetchone()
        return self._row_to_entity(row) if row else None

    def list_jobs(
        self,
        *,
        status: Optional[str] = None,
        type: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[BackgroundJob]:
        sql = (
            "SELECT id, type, payload, status, attempts, max_attempts, "
            "error, scheduled_at, started_at, completed_at, created_at "
            "FROM background_jobs WHERE 1 = 1"
        )
        params: list[Any] = []
        if status is not None:
            sql += " AND status = ?"
            params.append(status)
        if type is not None:
            sql += " AND type = ?"
            params.append(type)
        sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?"
        params += [limit, offset]
        with get_conn() as conn:
            rows = conn.execute(sql, params).fetchall()
        return [self._row_to_entity(r) for r in rows]

    def mark_running(self, job_id: str) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE background_jobs
                   SET status = 'running', started_at = datetime('now')
                   WHERE id = ?""",
                (job_id,),
            )
            conn.commit()

    def mark_completed(self, job_id: str) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE background_jobs
                   SET status = 'success', completed_at = datetime('now'),
                       error = NULL
                   WHERE id = ?""",
                (job_id,),
            )
            conn.commit()

    def mark_failed(self, job_id: str, error: str) -> None:
        with get_conn() as conn:
            conn.execute(
                """UPDATE background_jobs
                   SET status = 'failed', completed_at = datetime('now'),
                       error = ?
                   WHERE id = ?""",
                (error, job_id),
            )
            conn.commit()

    def increment_attempts(self, job_id: str) -> int:
        with get_conn() as conn:
            conn.execute(
                """UPDATE background_jobs
                   SET attempts = attempts + 1
                   WHERE id = ?""",
                (job_id,),
            )
            conn.commit()
            row = conn.execute(
                "SELECT attempts FROM background_jobs WHERE id = ?",
                (job_id,),
            ).fetchone()
        return int(row["attempts"]) if row else 0

    @staticmethod
    def _row_to_entity(row: sqlite3.Row) -> BackgroundJob:
        payload_raw = row["payload"]
        payload: dict[str, Any] = (
            json.loads(payload_raw) if payload_raw else {}
        )
        return BackgroundJob(
            id=row["id"],
            type=cast(JobType, row["type"]),
            payload=payload,
            status=cast(JobStatus, row["status"]),
            attempts=row["attempts"],
            max_attempts=row["max_attempts"],
            error=row["error"],
            scheduled_at=_parse_datetime(row["scheduled_at"]),
            started_at=_parse_datetime(row["started_at"]),
            completed_at=_parse_datetime(row["completed_at"]),
            created_at=_parse_datetime(row["created_at"]),
        )


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    normalised = value.replace("T", " ")
    try:
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return datetime.fromisoformat(value)


def _to_iso(value: Optional[datetime]) -> Optional[str]:
    return value.strftime("%Y-%m-%d %H:%M:%S") if value else None
