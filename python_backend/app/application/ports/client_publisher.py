"""ClientPublisher port — abstraction over WS broadcast for use cases."""
from abc import ABC, abstractmethod
from typing import Any


class ClientPublisher(ABC):
    """Broadcasts messages to connected WS clients (mac + web).

    Use cases depend on this port instead of the concrete ConnectionManager
    so they remain framework-agnostic."""

    @abstractmethod
    async def broadcast(self, message: dict[str, Any]) -> None: ...
