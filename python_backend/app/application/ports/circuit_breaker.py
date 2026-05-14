"""Port for circuit-breaker guard around external calls (B8).

Closed → open → half-open state machine per service name. Wraps an
arbitrary callable (sync or async). Raises ``ServiceUnavailableError``
when the breaker is open."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Any, Awaitable, Callable, Union


SyncOrAsyncFunc = Callable[..., Union[Any, Awaitable[Any]]]


class CircuitBreaker(ABC):
    @abstractmethod
    async def call(
        self,
        service_name: str,
        func: SyncOrAsyncFunc,
        *args: Any,
        **kwargs: Any,
    ) -> Any:
        """Invoke ``func`` under the breaker's protection.

        - Closed: forwards the call. On exception, increments failure
          count; opens after ``failure_threshold`` consecutive errors.
        - Open: raises ``ServiceUnavailableError`` until cooldown elapses.
        - Half-open (after cooldown): forwards a single probe call. On
          success the breaker closes; on failure it re-opens."""
        ...

    @abstractmethod
    def state(self, service_name: str) -> str:
        """Return one of ``"closed"``, ``"open"``, ``"half-open"``."""
        ...

    @abstractmethod
    def reset(self, service_name: str) -> None:
        """Force the breaker back to closed (admin/test helper)."""
        ...
