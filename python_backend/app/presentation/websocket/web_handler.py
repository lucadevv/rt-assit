"""Web WebSocket handler. Receives the broadcast stream — does not generate.

B0: requires JWT in query param ``?token=...`` (validated via
``authenticate_websocket``). In dev mode the token is optional and we
synthesise the ``dev_default`` user."""
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.application.services.transcript_session_state import (
    SessionStateRegistry,
)
from app.presentation.websocket.auth import authenticate_websocket
from app.presentation.websocket.connection_manager import ConnectionManager


logger = logging.getLogger(__name__)


async def web_endpoint(
    websocket: WebSocket,
    manager: ConnectionManager,
    session_state_registry: SessionStateRegistry,
) -> None:
    # Authenticate BEFORE accept(). authenticate_websocket() handles the close
    # path (1008) on failure and raises WebSocketDisconnect.
    try:
        user = await authenticate_websocket(websocket)
    except WebSocketDisconnect:
        return

    client_id = f"web_{id(websocket)}"
    # B3 — session routing: web clients pass ?session_id=... so the
    # backend can target events (speaker_label_updated, speakers_merged) to
    # the specific session room. Optional for legacy clients.
    session_id = websocket.query_params.get("session_id")
    await manager.connect_web(client_id, websocket, session_id=session_id)

    try:
        await websocket.send_json(
            {
                "type": "connected",
                "message": "Connected to RTAssist (web)",
                "user_id": user.id if user else None,
                "session_id": session_id,
            }
        )

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})
            elif message.get("type") == "screen_text":
                # G2 — OCR text from the web client's shared MediaStream.
                # Routed by the per-connection session_id (set at WS
                # open) into the session-scoped conversation state. The
                # next transcript turn reads it through
                # ``SessionConversationState.get_screen_text()`` (which
                # enforces freshness + confidence gates) and threads it
                # into the prompt builder via ``{screen_text_block}``.
                #
                # Defensive: we coerce the payload here so the state
                # method gets clean types. Validation failures are
                # swallowed silently — OCR is best-effort context and
                # MUST NEVER break the transcript pipeline.
                if not session_id:
                    continue
                try:
                    state = session_state_registry.get(session_id)
                    text = message.get("text", "")
                    confidence = float(message.get("confidence", 0.0))
                    captured_at_ms = int(message.get("captured_at_ms", 0))
                    state.set_screen_text(
                        text=text,
                        confidence=confidence,
                        captured_at_ms=captured_at_ms,
                    )
                    logger.debug(
                        "[WS:web] screen_text stored session=%s "
                        "len=%d conf=%.2f",
                        session_id,
                        len(text) if isinstance(text, str) else 0,
                        confidence,
                    )
                except (TypeError, ValueError, KeyError) as e:
                    logger.warning(
                        "[WS:web] invalid screen_text payload "
                        "(session=%s): %s",
                        session_id, e,
                    )

    except WebSocketDisconnect:
        logger.info(f"Web client {client_id} disconnected")
    finally:
        manager.disconnect_web(client_id)
        # Defensive cleanup of the per-session conversation state. The
        # primary cleanup point is POST /api/sessions/{id}/end, but a
        # browser refresh / tab close skips that — without this pop the
        # in-memory state lingered until process restart and could leak
        # into the next session reusing the same id.
        if session_id:
            session_state_registry.pop(session_id)
