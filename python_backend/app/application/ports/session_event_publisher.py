"""SessionEventPublisher port (B3).

Abstraction for broadcasting session-scoped events (e.g. ``speaker_label_updated``)
to all WS clients connected to a given session_id. Implemented by
``ConnectionManager`` which already tracks the live web/mac client sockets.

Distinct from ``ClientPublisher`` (which fans out a single broadcast to all
clients, used for hints): this one routes to a specific session room.
"""
from abc import ABC, abstractmethod
from typing import Any


class SessionEventPublisher(ABC):
    """Broadcasts events to all WS clients of a given session."""

    @abstractmethod
    async def publish_to_session(
        self, session_id: str, event: dict[str, Any]
    ) -> None:
        """Send ``event`` to every WS client currently registered with
        the given ``session_id``. Implementations MUST swallow per-client
        errors so a single broken socket cannot poison the broadcast."""
        ...
