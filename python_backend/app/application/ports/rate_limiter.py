"""Port for sliding-window rate limiting (B8).

Async because the prod swap will be Redis (network I/O). The dev impl
is in-memory and runs synchronously under the asyncio.Lock guard."""
from __future__ import annotations

from abc import ABC, abstractmethod


class RateLimiter(ABC):
    @abstractmethod
    async def check_and_increment(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> bool:
        """Return True iff the request is allowed (and the counter has
        been incremented). Return False when the bucket is full."""
        ...

    @abstractmethod
    async def get_remaining(
        self, key: str, max_requests: int, window_seconds: int
    ) -> int:
        """Return the remaining quota for ``key`` (0 if rate-limited)."""
        ...
