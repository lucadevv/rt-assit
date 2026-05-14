"""Mac WebSocket handler (legacy — less used).

Accepts a transcript text and runs it through the agent. Echoes pings."""
import json
import logging

from fastapi import WebSocket, WebSocketDisconnect

from app.application.use_cases.process_transcript import ProcessTranscriptUseCase
from app.presentation.websocket.connection_manager import ConnectionManager


logger = logging.getLogger(__name__)


SESSION_ID = "default"


async def mac_endpoint(
    websocket: WebSocket,
    manager: ConnectionManager,
    process_uc: ProcessTranscriptUseCase,
) -> None:
    client_id = f"mac_{id(websocket)}"
    await manager.connect_mac(client_id, websocket)

    try:
        await websocket.send_json(
            {"type": "connected", "message": "Connected to RTAssist"}
        )

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "transcript":
                transcript = message.get("text", "").strip()
                if transcript:
                    await process_uc.execute(
                        transcript=transcript,
                        is_speculative=False,
                        session_id=SESSION_ID,
                    )

            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"Mac client {client_id} disconnected")
    finally:
        manager.disconnect_mac(client_id)
