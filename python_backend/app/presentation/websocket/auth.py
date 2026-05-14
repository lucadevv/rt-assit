"""WebSocket auth helper.

FastAPI's `Depends()` doesn't compose cleanly inside the WebSocket receive
loop, so this module exposes an explicit ``authenticate_websocket()`` that
WS handlers call right after ``websocket.accept()`` is implicit (or before
accept, as we do here so we can close with a 1008 policy code).

Auth tier: ``WS-JWT`` (JWT in query param ``?token=...``). In dev mode the
token is optional and the handler synthesises ``dev_default``. For rt_go
(internal/trusted gateway) we currently allow connections without a token
in dev mode and document the multi-tenant TODO for B1."""
import logging
import os
import secrets
from typing import Optional

from fastapi import WebSocket, WebSocketDisconnect, status

from app.application.use_cases.ensure_user_exists import EnsureUserExistsUseCase
from app.domain.entities.user import User
from app.domain.exceptions import UnauthorizedError
from app.presentation.deps import (
    get_auth_validator,
    get_users_repository,
    is_dev_mode,
)


logger = logging.getLogger(__name__)


_DEV_SENTINEL_TOKEN = "dev-token"  # noqa: S105


async def authenticate_websocket(
    websocket: WebSocket,
) -> Optional[User]:
    """Validate ``?token=...`` and return the User entity.

    Behaviour:
    - In prod mode (AUTH_MODE=clerk) and missing/invalid token: closes the
      socket with code 1008 (policy violation) and raises WebSocketDisconnect.
    - In dev mode: synthesises the ``dev_default`` user without requiring
      a token.

    Returns the User on success. Caller is responsible for ``accept()``."""
    token = websocket.query_params.get("token")

    if not token:
        if not is_dev_mode():
            await websocket.close(
                code=status.WS_1008_POLICY_VIOLATION,
                reason="Token requerido",
            )
            raise WebSocketDisconnect(code=status.WS_1008_POLICY_VIOLATION)
        token = _DEV_SENTINEL_TOKEN

    try:
        validator = get_auth_validator()
        claims = await validator.validate(token)
    except UnauthorizedError as e:
        logger.info(f"WS auth rejected: {e}")
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Token inválido",
        )
        raise WebSocketDisconnect(code=status.WS_1008_POLICY_VIOLATION) from e
    except Exception as e:  # noqa: BLE001
        logger.warning(f"WS auth validator failure: {e}")
        await websocket.close(
            code=status.WS_1011_INTERNAL_ERROR,
            reason="Error de autenticación",
        )
        raise WebSocketDisconnect(
            code=status.WS_1011_INTERNAL_ERROR
        ) from e

    repo = get_users_repository()
    use_case = EnsureUserExistsUseCase(repo)
    return use_case.execute(claims=claims)


async def authenticate_websocket_optional(
    websocket: WebSocket,
) -> Optional[User]:
    """Auth helper for trusted/internal sockets (rt_go).

    rt_go is an internal Docker-network gateway. For B0 it can connect
    without a JWT in dev mode. TODO(B1): require an HMAC-signed shared
    secret OR forward the user's JWT through the rt_go handshake."""
    token = websocket.query_params.get("token")
    if not token:
        if is_dev_mode():
            return None
        # Prod: rt_go must forward an authenticated user.
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Token requerido para rt_go",
        )
        raise WebSocketDisconnect(code=status.WS_1008_POLICY_VIOLATION)
    return await authenticate_websocket(websocket)


async def authenticate_service_websocket(
    websocket: WebSocket,
    expected_token_env_var: str,
) -> bool:
    """Service-to-service WS auth via shared token.

    Used for trusted, service-to-service WebSocket endpoints (rt_go Go
    gateway, native macOS app) which do NOT carry a Clerk JWT. Auth model:

    - In dev mode (AUTH_MODE=dev, the default), this check is skipped
      entirely and always returns True. This keeps local iteration
      frictionless (rt_go / mac binaries can connect without a token).
    - In prod mode (AUTH_MODE != "dev"), the client MUST supply
      ``?service_token=...`` in the WS URL query string. The provided
      value is compared via ``secrets.compare_digest()`` against the env
      var named by ``expected_token_env_var`` (e.g. RT_GO_SERVICE_TOKEN,
      MAC_SERVICE_TOKEN). On mismatch (or if the env var is unset/empty),
      the socket is closed with WS 1008 (policy violation) and False is
      returned. On success, True is returned and the caller proceeds to
      ``websocket.accept()``.

    Returns:
        True if auth passed (or dev mode), False if the connection was
        rejected. Callers MUST NOT call ``accept()`` when False.

    Args:
        websocket: The incoming WebSocket connection.
        expected_token_env_var: Name of the env var holding the expected
            shared token (e.g. ``"RT_GO_SERVICE_TOKEN"``).
    """
    if is_dev_mode():
        return True

    expected = os.getenv(expected_token_env_var, "").strip()
    if not expected:
        logger.error(
            "Service WS auth misconfigured: %s is unset in prod mode",
            expected_token_env_var,
        )
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Service token no configurado",
        )
        return False

    provided = websocket.query_params.get("service_token", "")
    if not provided or not secrets.compare_digest(provided, expected):
        logger.info(
            "Service WS auth rejected (env=%s): token mismatch",
            expected_token_env_var,
        )
        await websocket.close(
            code=status.WS_1008_POLICY_VIOLATION,
            reason="Service token inválido",
        )
        return False

    return True
