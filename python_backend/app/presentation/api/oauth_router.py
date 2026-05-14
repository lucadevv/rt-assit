"""OAuth REST endpoints (Meeting Frame).

* ``/google/*``    — fully wired in Sprint 1 (this file).
* ``/microsoft/*`` — 501 until Sprint 2.
* ``/zoom/*``      — 501 until Sprint 3.
* ``/connected``   — fully wired since Sprint 0 (lists linked providers
  without leaking any token material).

Route layout (registration order matters — FastAPI matches first):

  1. Provider-specific concrete routes (``/google/authorize`` …) — use
     ``Depends(get_google_oauth_client)`` so tests can override the client.
  2. Catch-all ``/{provider}/...`` returning 501 for microsoft / zoom and
     400 for unknown providers.

CSRF protection: ``/google/authorize`` generates a one-shot ``state``
token (``secrets.token_urlsafe``) stored in a module-level dict alongside
the user id. ``/google/callback`` pops + validates that token. TODO:
move the dict to Redis (or any shared store) before the multi-replica
deployment in Sprint 4."""
from __future__ import annotations

import logging
import secrets
import time
import uuid
from typing import Any, get_args

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.application.ports.oauth_token_storage import OAuthTokenStorage
from app.domain.entities.oauth_credential import OAuthCredential, OAuthProviderId
from app.domain.entities.user import User
from app.infrastructure.oauth.google_oauth_client import (
    GoogleOAuthClient,
    OAuthExchangeError,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_google_oauth_client,
    get_oauth_repository,
)


logger = logging.getLogger(__name__)


router = APIRouter(prefix="/api/oauth")
# Module-level alias so callers can `from ... import oauth_router` directly
# (matches the smoke-test contract). The package-style `oauth_router.router`
# import in app/main.py keeps working because the module name is the same.
oauth_router = router


_VALID_PROVIDERS: frozenset[str] = frozenset(get_args(OAuthProviderId))


# ----- CSRF state store (in-memory) ------------------------------------------
#
# Maps ``state -> (user_id, created_at_unix)``. Single-process only; replace
# with Redis when we ship multi-replica.

_StateValue = tuple[str, float]
_oauth_state_store: dict[str, _StateValue] = {}

# How long an unused state token stays valid before being garbage-collected.
_STATE_TTL_SECONDS = 600.0  # 10 minutes


def _prune_expired_states(now: float) -> None:
    cutoff = now - _STATE_TTL_SECONDS
    stale = [s for s, (_, ts) in _oauth_state_store.items() if ts < cutoff]
    for s in stale:
        _oauth_state_store.pop(s, None)


# ----- Pydantic response models ----------------------------------------------


class ConnectedProviderResponse(BaseModel):
    provider: OAuthProviderId
    expires_at: int


class NotImplementedResponse(BaseModel):
    detail: str
    provider: str


class AuthorizeResponse(BaseModel):
    authorization_url: str
    state: str


class CallbackResponse(BaseModel):
    connected: bool
    provider: OAuthProviderId
    user_id: str


class RevokeResponse(BaseModel):
    revoked: bool
    provider: OAuthProviderId


# ----- Helpers ----------------------------------------------------------------


def _validate_provider(provider: str) -> OAuthProviderId:
    if provider not in _VALID_PROVIDERS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported provider: {provider}",
        )
    return provider  # type: ignore[return-value]


# =============================================================================
# /connected  (provider-agnostic, no token leak)
# =============================================================================


@router.get(
    "/connected",
    response_model=list[ConnectedProviderResponse],
)
async def list_connected(
    user: User = Depends(get_current_user),
    repo: OAuthTokenStorage = Depends(get_oauth_repository),
) -> list[ConnectedProviderResponse]:
    creds = repo.list_for_user(user.id)
    return [
        ConnectedProviderResponse(
            provider=c.provider, expires_at=c.expires_at
        )
        for c in creds
    ]


# =============================================================================
# /google/*  (Sprint 1 — fully implemented)
# =============================================================================


@router.get(
    "/google/authorize",
    response_model=AuthorizeResponse,
)
async def google_authorize(
    user: User = Depends(get_current_user),
    client: GoogleOAuthClient = Depends(get_google_oauth_client),
) -> AuthorizeResponse:
    """Return the consent-screen URL for Google."""
    state = secrets.token_urlsafe(32)
    now = time.time()
    _prune_expired_states(now)
    _oauth_state_store[state] = (user.id, now)

    url = client.get_authorization_url(state)
    logger.info(
        "[oauth] /google/authorize issued state=%s user_id=%s",
        state[:8],
        user.id,
    )
    return AuthorizeResponse(authorization_url=url, state=state)


@router.get("/google/callback")
async def google_callback(
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
    error: str | None = Query(default=None),
    repo: OAuthTokenStorage = Depends(get_oauth_repository),
    client: GoogleOAuthClient = Depends(get_google_oauth_client),
) -> CallbackResponse:
    """Handle Google's redirect: validate state, exchange code, persist."""
    if error:
        logger.warning("[oauth] /google/callback error=%s", error)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "oauth_error", "error": error},
        )

    if not state or state not in _oauth_state_store:
        logger.warning(
            "[oauth] /google/callback invalid_state state=%s",
            (state or "")[:8],
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "invalid_state"},
        )

    if not code:
        # State was valid but code missing — drop it so it can't be replayed.
        _oauth_state_store.pop(state, None)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"detail": "missing_code"},
        )

    user_id, _ts = _oauth_state_store.pop(state)

    try:
        tokens: dict[str, Any] = await client.exchange_code(code)
    except OAuthExchangeError as exc:
        logger.error(
            "[oauth] /google/callback exchange_code failed status=%s body=%s",
            exc.status_code,
            exc.body,
        )
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"detail": "token_exchange_failed"},
        ) from exc

    access_token = tokens.get("access_token")
    refresh_token = tokens.get("refresh_token", "")
    expires_in = int(tokens.get("expires_in", 0))
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"detail": "missing_access_token"},
        )

    now_ms = int(time.time() * 1000)
    expires_at = now_ms + expires_in * 1000

    credential = OAuthCredential(
        id=str(uuid.uuid4()),
        user_id=user_id,
        provider="google",
        access_token=access_token,
        refresh_token=refresh_token,
        expires_at=expires_at,
        created_at=now_ms,
        updated_at=now_ms,
    )
    repo.save(credential)
    logger.info(
        "[oauth] /google/callback saved credential user_id=%s expires_in=%ss",
        user_id,
        expires_in,
    )
    return CallbackResponse(connected=True, provider="google", user_id=user_id)


@router.post("/google/revoke")
async def google_revoke(
    user: User = Depends(get_current_user),
    repo: OAuthTokenStorage = Depends(get_oauth_repository),
    client: GoogleOAuthClient = Depends(get_google_oauth_client),
) -> RevokeResponse:
    """Revoke the user's Google credential."""
    credential = repo.get(user.id, "google")
    if credential is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={"detail": "not_connected", "provider": "google"},
        )

    token_to_revoke = credential.refresh_token or credential.access_token
    try:
        await client.revoke(token_to_revoke)
    except OAuthExchangeError as exc:
        logger.error(
            "[oauth] /google/revoke provider revoke failed status=%s body=%s",
            exc.status_code,
            exc.body,
        )
        # Best-effort cleanup — drop the local row even if Google refused.

    repo.delete(user.id, "google")
    return RevokeResponse(revoked=True, provider="google")


# =============================================================================
# /{provider}/* catch-all  (microsoft / zoom — 501; unknown — 400)
# Registered LAST so concrete /google/* routes match first.
# =============================================================================


@router.get(
    "/{provider}/authorize",
    response_model=NotImplementedResponse,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def authorize_catchall(
    provider: str,
    user: User = Depends(get_current_user),
) -> NotImplementedResponse:
    _validate_provider(provider)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"detail": "not_implemented", "provider": provider},
    )


@router.get(
    "/{provider}/callback",
    response_model=NotImplementedResponse,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def callback_catchall(
    provider: str,
    code: str | None = Query(default=None),
    state: str | None = Query(default=None),
) -> NotImplementedResponse:
    _validate_provider(provider)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"detail": "not_implemented", "provider": provider},
    )


@router.post(
    "/{provider}/revoke",
    response_model=NotImplementedResponse,
    status_code=status.HTTP_501_NOT_IMPLEMENTED,
)
async def revoke_catchall(
    provider: str,
    user: User = Depends(get_current_user),
) -> NotImplementedResponse:
    _validate_provider(provider)
    raise HTTPException(
        status_code=status.HTTP_501_NOT_IMPLEMENTED,
        detail={"detail": "not_implemented", "provider": provider},
    )
