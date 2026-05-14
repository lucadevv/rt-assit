"""WebSocket connection manager.

Implements two ports:
- ``ClientPublisher`` (B0+): fan-out broadcast to mac+web (used by hint
  streaming).
- ``SessionEventPublisher`` (B3): targeted publish to all WS clients
  registered with a specific ``session_id`` (used by speaker rename /
  merge for live multi-tab sync).
"""
import logging
from typing import Any, Optional

from fastapi import WebSocket
from starlette.websockets import WebSocketState

from app.application.ports.client_publisher import ClientPublisher
from app.application.ports.session_event_publisher import SessionEventPublisher


logger = logging.getLogger(__name__)


class ConnectionManager(ClientPublisher, SessionEventPublisher):
    """Owns the rt_go / mac / web WS connections.

    Implements ClientPublisher: ``broadcast()`` fans out to mac+web clients.
    Implements SessionEventPublisher: ``publish_to_session()`` routes to
    the subset of web clients registered with a given session_id."""

    def __init__(self) -> None:
        self.rt_go_client: Optional[WebSocket] = None
        self.mac_clients: dict[str, WebSocket] = {}
        self.web_clients: dict[str, WebSocket] = {}
        # B3 — session routing: web client_id -> session_id (the room)
        self.web_client_sessions: dict[str, str] = {}

    # --- connect/disconnect -----------------------------------------------

    async def connect_rt_go(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.rt_go_client = websocket
        logger.info("rt_go client connected")

    async def connect_mac(self, client_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self.mac_clients[client_id] = websocket
        logger.info(f"Mac client {client_id} connected")

    async def connect_web(
        self,
        client_id: str,
        websocket: WebSocket,
        session_id: Optional[str] = None,
    ) -> None:
        await websocket.accept()
        self.web_clients[client_id] = websocket
        if session_id:
            self.web_client_sessions[client_id] = session_id
            logger.info(
                f"Web client {client_id} connected (session={session_id})"
            )
        else:
            logger.info(f"Web client {client_id} connected (no session)")

    def disconnect_rt_go(self) -> None:
        self.rt_go_client = None

    def disconnect_mac(self, client_id: str) -> None:
        self.mac_clients.pop(client_id, None)

    def disconnect_web(self, client_id: str) -> None:
        self.web_clients.pop(client_id, None)
        self.web_client_sessions.pop(client_id, None)

    # --- broadcasting ------------------------------------------------------

    async def broadcast_to_mac(self, message: dict[str, Any]) -> None:
        for client_id, ws in list(self.mac_clients.items()):
            if ws.client_state == WebSocketState.CONNECTED:
                try:
                    await ws.send_json(message)
                except Exception as e:  # noqa: BLE001
                    logger.error(f"Error sending to mac {client_id}: {e}")

    async def broadcast_to_web(self, message: dict[str, Any]) -> None:
        for client_id, ws in list(self.web_clients.items()):
            if ws.client_state == WebSocketState.CONNECTED:
                try:
                    await ws.send_json(message)
                except Exception as e:  # noqa: BLE001
                    logger.error(f"Error sending to web {client_id}: {e}")

    async def broadcast(self, message: dict[str, Any]) -> None:
        """ClientPublisher impl — broadcasts to mac + web clients."""
        await self.broadcast_to_mac(message)
        await self.broadcast_to_web(message)

    # --- B3: session-scoped publish ---------------------------------------

    async def publish_to_session(
        self, session_id: str, event: dict[str, Any]
    ) -> None:
        """SessionEventPublisher impl.

        Sends ``event`` to all web clients that registered with this
        ``session_id`` on connect. Per-client errors are swallowed so a
        single broken socket cannot prevent the broadcast from reaching
        the rest of the room."""
        targets = [
            (cid, ws)
            for cid, ws in list(self.web_clients.items())
            if self.web_client_sessions.get(cid) == session_id
        ]
        if not targets:
            logger.debug(
                "[B3] publish_to_session: no clients for session=%s", session_id
            )
            return
        for client_id, ws in targets:
            if ws.client_state != WebSocketState.CONNECTED:
                continue
            try:
                await ws.send_json(event)
            except Exception as e:  # noqa: BLE001
                logger.error(
                    f"[B3] Failed to publish to web client {client_id}: {e}"
                )
