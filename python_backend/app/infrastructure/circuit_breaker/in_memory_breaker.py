"""In-memory CircuitBreaker implementation (B8).

Per-service state machine: closed → open (after N consecutive failures)
→ half-open (after cooldown). Half-open admits a single probe call;
success closes the breaker, failure re-opens with a fresh cooldown.

Single-process state — production may swap to Redis or per-replica
breakers. The CircuitBreaker port keeps the application layer
agnostic."""
from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

from app.application.ports.circuit_breaker import (
    CircuitBreaker,
    SyncOrAsyncFunc,
)
from app.domain.exceptions import ServiceUnavailableError


logger = logging.getLogger(__name__)


class _BreakerState:
    __slots__ = ("state", "failures", "opened_at")

    def __init__(self) -> None:
        self.state: str = "closed"
        self.failures: int = 0
        self.opened_at: float = 0.0


class InMemoryCircuitBreaker(CircuitBreaker):
    def __init__(
        self,
        *,
        failure_threshold: int = 5,
        cooldown_seconds: int = 300,
    ) -> None:
        self._states: dict[str, _BreakerState] = {}
        self._lock = asyncio.Lock()
        self.threshold = failure_threshold
        self.cooldown = cooldown_seconds

    def state(self, service_name: str) -> str:
        st = self._states.get(service_name)
        return st.state if st else "closed"

    def reset(self, service_name: str) -> None:
        st = self._states.get(service_name)
        if st:
            st.state = "closed"
            st.failures = 0
            st.opened_at = 0.0

    async def call(
        self,
        service_name: str,
        func: SyncOrAsyncFunc,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        # Pre-call: check + maybe transition open->half-open.
        async with self._lock:
            st = self._states.setdefault(service_name, _BreakerState())
            if st.state == "open":
                elapsed = time.time() - st.opened_at
                if elapsed >= self.cooldown:
                    st.state = "half-open"
                    logger.info(
                        f"[CircuitBreaker] {service_name} cooldown elapsed; "
                        f"entering half-open"
                    )
                else:
                    raise ServiceUnavailableError(
                        f"Servicio {service_name} temporalmente no disponible. "
                        f"Reintentá en unos minutos."
                    )

        try:
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)
        except Exception as e:
            async with self._lock:
                st = self._states.setdefault(service_name, _BreakerState())
                st.failures += 1
                if st.state == "half-open" or st.failures >= self.threshold:
                    st.state = "open"
                    st.opened_at = time.time()
                    logger.warning(
                        f"[CircuitBreaker] {service_name} OPEN "
                        f"(failures={st.failures}, threshold={self.threshold})"
                    )
            raise

        # Success path: close if half-open, reset failures.
        async with self._lock:
            st = self._states.setdefault(service_name, _BreakerState())
            if st.state == "half-open":
                logger.info(
                    f"[CircuitBreaker] {service_name} probe succeeded; closing"
                )
            st.state = "closed"
            st.failures = 0
        return result


def create_circuit_breaker() -> CircuitBreaker:
    import os

    threshold = int(os.getenv("CIRCUIT_BREAKER_THRESHOLD", "5"))
    cooldown = int(os.getenv("CIRCUIT_BREAKER_COOLDOWN", "300"))
    return InMemoryCircuitBreaker(
        failure_threshold=threshold, cooldown_seconds=cooldown
    )
