"""WebSocket router — mounts the 3 endpoints under /ws/*."""
from fastapi import APIRouter, WebSocket

from app.presentation.deps import (
    build_process_transcript_use_case,
    get_connection_manager,
    get_session_state_registry,
)
from app.presentation.websocket.auth import authenticate_service_websocket
from app.presentation.websocket.mac_handler import mac_endpoint
from app.presentation.websocket.rt_go_handler import rt_go_endpoint
from app.presentation.websocket.web_handler import web_endpoint


router = APIRouter()


@router.websocket("/ws/rt-go")
async def rt_go_ws(websocket: WebSocket) -> None:
    # Service-to-service auth: dev mode bypasses, prod requires a matching
    # ``?service_token=...`` against RT_GO_SERVICE_TOKEN. On rejection the
    # helper closes the socket with 1008 and we exit before .accept().
    if not await authenticate_service_websocket(
        websocket, "RT_GO_SERVICE_TOKEN"
    ):
        return
    manager = get_connection_manager()
    process_uc = build_process_transcript_use_case()
    # Fase C — rt_go forwards Deepgram's UtteranceEnd events; the handler
    # routes them to the per-session SessionConversationState so the
    # LangGraph coalesce_node can early-exit its wall-clock window.
    session_state_registry = get_session_state_registry()
    await rt_go_endpoint(websocket, manager, process_uc, session_state_registry)


@router.websocket("/ws/mac")
async def mac_ws(websocket: WebSocket) -> None:
    # Service-to-service auth: dev mode bypasses, prod requires a matching
    # ``?service_token=...`` against MAC_SERVICE_TOKEN.
    if not await authenticate_service_websocket(
        websocket, "MAC_SERVICE_TOKEN"
    ):
        return
    manager = get_connection_manager()
    process_uc = build_process_transcript_use_case()
    await mac_endpoint(websocket, manager, process_uc)


@router.websocket("/ws/web")
async def web_ws(websocket: WebSocket) -> None:
    manager = get_connection_manager()
    session_state_registry = get_session_state_registry()
    await web_endpoint(websocket, manager, session_state_registry)
