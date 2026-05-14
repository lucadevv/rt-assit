"""Failover wrapper — primary LLM with automatic fallback on error.

The primary attempt is tried first. If it raises ANY of:
  - httpx.TimeoutException / httpx.ConnectError / httpx.RemoteProtocolError
  - httpx.HTTPStatusError (5xx OR 429)
  - other transient network errors

BEFORE emitting any tokens, the fallback is attempted. Once the primary
has yielded at least one token, errors propagate normally (mid-stream
switching would produce garbled output).

Empty content (primary returned 0 tokens but no exception) is treated as
a failover trigger: if the primary's own salvage retry path didn't
recover, we hand off to the fallback so the user still gets a response
rather than an empty turn.
"""
from __future__ import annotations

import logging
from typing import AsyncIterator, List, Optional, Any

import httpx

from app.application.ports.llm_provider import LLMProvider
from app.domain.entities.chat_message import ChatMessage


logger = logging.getLogger(__name__)


# Errors that trigger failover (transient / provider-side).
_FAILOVER_EXCEPTIONS: tuple[type[BaseException], ...] = (
    httpx.TimeoutException,
    httpx.ConnectError,
    httpx.ConnectTimeout,
    httpx.ReadTimeout,
    httpx.RemoteProtocolError,
    httpx.NetworkError,
)


def _is_transient_http_status(exc: BaseException) -> bool:
    """True for HTTP 5xx and 429 (rate limit) status errors."""
    if isinstance(exc, httpx.HTTPStatusError):
        sc = exc.response.status_code
        return sc >= 500 or sc == 429
    return False


def _is_failover_trigger(exc: BaseException) -> bool:
    return isinstance(exc, _FAILOVER_EXCEPTIONS) or _is_transient_http_status(exc)


class FailoverLLMClient(LLMProvider):
    """LLMProvider decorator that switches to ``fallback`` when ``primary``
    fails BEFORE emitting any tokens.

    Construction is dependency-injection: both ``primary`` and ``fallback``
    are themselves ``LLMProvider`` instances built by the factory, so this
    wrapper does NOT know about concrete provider classes.
    """

    def __init__(
        self,
        primary: LLMProvider,
        fallback: LLMProvider,
        primary_name: str = "primary",
        fallback_name: str = "fallback",
    ) -> None:
        self.primary = primary
        self.fallback = fallback
        self.primary_name = primary_name
        self.fallback_name = fallback_name

    async def stream(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
        reasoning_override: Any = ...,
    ) -> AsyncIterator[str]:
        """Try primary; if it fails BEFORE first token, switch to fallback.

        Implementation detail: we materialise the first token from the
        primary's async generator BEFORE forwarding. If that raises, we
        run the fallback instead. If the primary yields at least one
        token, we hand off the rest of the stream as-is.

        Sentinel forwarding: each concrete provider has its OWN private
        ``_Unset`` class for "caller did not say". Forwarding our local
        ``...`` Ellipsis sentinel to the child would fail their sentinel
        check and they would try to use Ellipsis as a real value (it
        ends up in the request JSON body — `TypeError: ellipsis is not
        JSON serializable`). So we OMIT the kwarg when it's our default
        and let each child use its own "did not say" path.
        """
        # Build kwargs once so the omit-on-default logic stays DRY across
        # the primary path and both fallback paths.
        child_kwargs: dict[str, Any] = {
            "messages": messages,
            "system": system,
            "max_tokens": max_tokens,
        }
        if reasoning_override is not ...:
            child_kwargs["reasoning_override"] = reasoning_override

        primary_iter = self.primary.stream(**child_kwargs)
        # Try to pull the first chunk from the primary.
        first_chunk: Optional[str] = None
        try:
            async for chunk in primary_iter:
                first_chunk = chunk
                break
        except Exception as exc:  # noqa: BLE001
            if _is_failover_trigger(exc):
                logger.warning(
                    "[LLM:failover] Primary (%s) failed pre-stream: %r — switching to fallback (%s)",
                    self.primary_name, exc, self.fallback_name,
                )
                async for chunk in self.fallback.stream(**child_kwargs):
                    yield chunk
                return
            # Non-transient error — propagate.
            raise

        if first_chunk is None:
            # Primary produced no tokens AND raised no exception. Its own
            # salvage retry didn't recover. Fall over.
            logger.warning(
                "[LLM:failover] Primary (%s) produced empty stream — switching to fallback (%s)",
                self.primary_name, self.fallback_name,
            )
            async for chunk in self.fallback.stream(**child_kwargs):
                yield chunk
            return

        # Primary is healthy — forward first chunk and the rest.
        yield first_chunk
        try:
            async for chunk in primary_iter:
                yield chunk
        except Exception as exc:  # noqa: BLE001
            # Mid-stream failure — can't switch cleanly. Log and re-raise.
            logger.error(
                "[LLM:failover] Primary (%s) failed MID-STREAM after %d chars — propagating: %r",
                self.primary_name, len(first_chunk), exc,
            )
            raise

    async def complete(
        self,
        messages: List[ChatMessage],
        system: Optional[str] = None,
        max_tokens: Optional[int] = None,
    ) -> str:
        try:
            return await self.primary.complete(
                messages=messages, system=system, max_tokens=max_tokens,
            )
        except Exception as exc:  # noqa: BLE001
            if not _is_failover_trigger(exc):
                raise
            logger.warning(
                "[LLM:failover] Primary (%s) complete() failed: %r — using fallback (%s)",
                self.primary_name, exc, self.fallback_name,
            )
            return await self.fallback.complete(
                messages=messages, system=system, max_tokens=max_tokens,
            )
