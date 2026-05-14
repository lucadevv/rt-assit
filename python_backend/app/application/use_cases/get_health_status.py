"""GetHealthStatusUseCase (B8).

Aggregates a list of ``HealthProbe`` instances into a flat dict that the
``/health`` endpoint serialises. Each probe is responsible for catching
its own errors — this orchestrator never raises. A probe that crashes is
recorded as ``"down"`` so the health endpoint stays available even when
external dependencies are exploding."""
from __future__ import annotations

import logging

from app.application.ports.health_check import HealthProbe


logger = logging.getLogger(__name__)


class GetHealthStatusUseCase:
    def __init__(self, probes: list[HealthProbe]) -> None:
        self.probes = probes

    async def execute(self) -> dict[str, str]:
        result: dict[str, str] = {}
        for probe in self.probes:
            try:
                status = await probe.check()
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"[Health] Probe {probe.name} crashed: {e}"
                )
                status = "down"
            result[probe.name] = status
        return result
