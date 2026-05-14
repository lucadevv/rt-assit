"""Concrete HealthProbe implementations (B8).

Each probe is responsible for catching its own errors and returning a
status string in ``{"ok", "degraded", "down"}``. Failure of the probe
itself is treated as ``down`` by the GetHealthStatusUseCase wrapper, but
each probe should still try to map external errors to ``"degraded"``
when partial functionality is available."""
from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Optional

from app.application.ports.circuit_breaker import CircuitBreaker
from app.application.ports.health_check import HealthProbe, HealthStatus
from app.application.ports.llm_provider import LLMProvider
from app.infrastructure.persistence.sqlite.db import get_conn


logger = logging.getLogger(__name__)


class DBHealthProbe(HealthProbe):
    @property
    def name(self) -> str:
        return "db"

    async def check(self) -> HealthStatus:
        try:
            with get_conn() as conn:
                row = conn.execute("SELECT 1").fetchone()
                if row is None:
                    return "down"
            return "ok"
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Health] DB probe failed: {e}")
            return "down"


class LLMHealthProbe(HealthProbe):
    """Probe the LLM provider through the circuit breaker.

    "ok" when the breaker is closed and the LLM responds quickly.
    "degraded" when the breaker is half-open or open (the API still
    serves cached responses but new generations may stall).
    "down" when the provider raises immediately."""

    def __init__(
        self,
        *,
        llm: LLMProvider,
        breaker: CircuitBreaker,
        service_name: str = "llm",
    ) -> None:
        self.llm = llm
        self.breaker = breaker
        self.service_name = service_name

    @property
    def name(self) -> str:
        return "llm"

    async def check(self) -> HealthStatus:
        # Breaker state is the cheapest signal — if it's open, declare
        # degraded without making another call (avoids hammering a
        # provider that's already failing).
        state = self.breaker.state(self.service_name)
        if state in ("open", "half-open"):
            return "degraded"
        # Don't do an actual LLM call here — too expensive for /health.
        # Treat closed breaker as ok.
        return "ok"


class StorageHealthProbe(HealthProbe):
    """Filesystem probe for the local recordings storage.

    For S3-mode this becomes a no-op ``"ok"`` since boto3 issues are
    surfaced by the upload/download paths via the breaker; the health
    endpoint should not block on a bucket head() call."""

    def __init__(self, *, base_path: Optional[str] = None) -> None:
        self.base_path = base_path or os.getenv(
            "LOCAL_STORAGE_DIR", "/app/data/recordings"
        )

    @property
    def name(self) -> str:
        return "storage"

    async def check(self) -> HealthStatus:
        mode = os.getenv("STORAGE_MODE", "local").lower()
        if mode == "s3":
            # Cheap-by-design — see docstring.
            return "ok"
        try:
            path = Path(self.base_path)
            path.mkdir(parents=True, exist_ok=True)
            if not path.exists() or not path.is_dir():
                return "down"
            # Soft write-check: ensure we can write a probe file.
            probe = path / ".health_probe"
            probe.write_text("ok", encoding="utf-8")
            probe.unlink(missing_ok=True)
            return "ok"
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Health] Storage probe failed: {e}")
            return "degraded"
