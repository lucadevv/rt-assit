"""Integration tests for WebSocket service-token auth (Sprint B1).

Targets ``authenticate_service_websocket`` (used by /ws/rt-go and
/ws/mac in production). FastAPI's TestClient exposes
``.websocket_connect`` which we use to drive the connection.

We mount a tiny in-test WS handler that:
1. Calls ``authenticate_service_websocket(ws, "RT_GO_SERVICE_TOKEN")``.
2. Accepts on True, rejects (just returns) on False.
3. On accept, sends a single ``"ok"`` text and closes.

This isolates the auth helper from the production rt_go handler (which
needs the full ConnectionManager / LangGraph stack)."""
from __future__ import annotations

import pytest
from fastapi import FastAPI, WebSocket
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from app.presentation.websocket.auth import authenticate_service_websocket


# ---------------------------------------------------------------------------
# Minimal app — replaces the production /ws/rt-go binding with a tiny
# handler that ONLY exercises the auth helper.
# ---------------------------------------------------------------------------


@pytest.fixture()
def ws_app(_patched_env: None) -> FastAPI:
    app = FastAPI()

    @app.websocket("/ws/rt-go")
    async def rt_go_ws(websocket: WebSocket) -> None:
        if not await authenticate_service_websocket(
            websocket, "RT_GO_SERVICE_TOKEN"
        ):
            return
        await websocket.accept()
        await websocket.send_text("ok")
        await websocket.close()

    return app


@pytest.fixture()
def ws_client(ws_app: FastAPI) -> TestClient:
    return TestClient(ws_app)


# ---------------------------------------------------------------------------
# Tests — AUTH_MODE=custom (production-like) is set globally by
# _patched_env, so the service_token check IS enforced.
# ---------------------------------------------------------------------------


class TestWebSocketAuth:
    def test_ws_with_valid_service_token_connects(
        self, ws_client: TestClient
    ) -> None:
        # The env fixture sets RT_GO_SERVICE_TOKEN=test-rtgo-service-token.
        with ws_client.websocket_connect(
            "/ws/rt-go?service_token=test-rtgo-service-token"
        ) as ws:
            assert ws.receive_text() == "ok"

    def test_ws_without_service_token_rejected(
        self, ws_client: TestClient
    ) -> None:
        # No service_token query param → helper closes with 1008 and
        # returns False. The TestClient surfaces the close as a
        # WebSocketDisconnect raised from inside the ``with`` block.
        with pytest.raises(WebSocketDisconnect):
            with ws_client.websocket_connect("/ws/rt-go") as ws:
                # Reading from a closed-before-accept socket raises.
                ws.receive_text()

    def test_ws_with_invalid_service_token_rejected(
        self, ws_client: TestClient
    ) -> None:
        with pytest.raises(WebSocketDisconnect):
            with ws_client.websocket_connect(
                "/ws/rt-go?service_token=definitely-not-the-token"
            ) as ws:
                ws.receive_text()
