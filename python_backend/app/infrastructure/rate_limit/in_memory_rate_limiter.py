"""In-memory sliding-window RateLimiter implementation (B8).

Suitable for single-instance dev. Production should swap this for a
Redis-backed adapter (same RateLimiter port). State is per-process —
restarts wipe the counters, which is acceptable for sliding-window
limits since the worst case is briefly allowing extra requests."""
from __future__ import annotations

import asyncio
import time
from collections import defaultdict

from app.application.ports.rate_limiter import RateLimiter


class InMemoryRateLimiter(RateLimiter):
    def __init__(self) -> None:
        self._counters: dict[str, list[float]] = defaultdict(list)
        self._lock = asyncio.Lock()

    async def check_and_increment(
        self,
        key: str,
        max_requests: int,
        window_seconds: int,
    ) -> bool:
        async with self._lock:
            now = time.time()
            cutoff = now - window_seconds
            timestamps = [t for t in self._counters[key] if t > cutoff]
            if len(timestamps) >= max_requests:
                self._counters[key] = timestamps
                return False
            timestamps.append(now)
            self._counters[key] = timestamps
            return True

    async def get_remaining(
        self, key: str, max_requests: int, window_seconds: int
    ) -> int:
        async with self._lock:
            now = time.time()
            cutoff = now - window_seconds
            timestamps = [t for t in self._counters[key] if t > cutoff]
            self._counters[key] = timestamps
            return max(0, max_requests - len(timestamps))


def create_rate_limiter() -> RateLimiter:
    return InMemoryRateLimiter()
