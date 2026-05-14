"""Ports for service health probes (B8).

Each probe returns a status string in the set
``{"ok", "degraded", "down"}``. The ``GetHealthStatusUseCase`` aggregates
all probes into a single dict for the ``/health`` endpoint."""
from __future__ import annotations

from abc import ABC, abstractmethod


HealthStatus = str  # Literal["ok", "degraded", "down"] kept loose for forward compat.


class HealthProbe(ABC):
    @property
    @abstractmethod
    def name(self) -> str:
        """Name used as the dict key in the aggregated response (e.g. ``"db"``)."""
        ...

    @abstractmethod
    async def check(self) -> HealthStatus:
        """Run the probe. Must catch its own errors and return a status."""
        ...
