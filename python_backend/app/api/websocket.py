import asyncio
import json
import logging
import sys
import time
from typing import Any, Optional
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from starlette.websockets import WebSocketState

logging.basicConfig(stream=sys.stdout, level=logging.DEBUG)
from app.memory.vector_store import VectorStore
from app.memory.conversation import ConversationMemory

logger = logging.getLogger(__name__)

router = APIRouter()


class ConnectionManager:
    def __init__(self):
        self.rt_go_client: Optional[WebSocket] = None
        self.mac_clients: dict[str, WebSocket] = {}
        self.vector_store: Optional[VectorStore] = None
        self.conversation_memory: Optional[ConversationMemory] = None

    def set_dependencies(self, vector_store: VectorStore, conversation_memory: ConversationMemory):
        self.vector_store = vector_store
        self.conversation_memory = conversation_memory

    async def connect_rt_go(self, websocket: WebSocket):
        await websocket.accept()
        self.rt_go_client = websocket
        logger.info("rt_go client connected")

    async def connect_mac(self, client_id: str, websocket: WebSocket):
        await websocket.accept()
        self.mac_clients[client_id] = websocket
        logger.info(f"Mac client {client_id} connected")

    def disconnect_rt_go(self):
        self.rt_go_client = None

    def disconnect_mac(self, client_id: str):
        self.mac_clients.pop(client_id, None)

    async def broadcast_to_mac(self, message: dict[str, Any]):
        for client_id, ws in list(self.mac_clients.items()):
            if ws.client_state == WebSocketState.CONNECTED:
                try:
                    await ws.send_json(message)
                except Exception as e:
                    logger.error(f"Error sending to mac {client_id}: {e}")


manager = ConnectionManager()

# Deduplicación de transcripciones
last_transcript = {"text": "", "timestamp": 0}
import time


@router.websocket("/rt-go")
async def rt_go_endpoint(websocket: WebSocket):
    await manager.connect_rt_go(websocket)
    
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            logger.info(f"Received from rt_go: {message.get('type')}")
            
            if message.get("type") == "transcript":
                transcript = message.get("content", "").strip()
                if not transcript:
                    transcript = message.get("text", "").strip()
                
                is_final = message.get("is_final", True)
                
                logger.info(f"[RT-GO] Transcript: {transcript[:50]}... (final={is_final})")
                
                # Solo procesar si es final Y es diferente a la última procesada
                if is_final and transcript != last_transcript["text"]:
                    last_transcript["text"] = transcript
                    last_transcript["timestamp"] = time.time()
                    
                    # Reenviar a todos los clientes Mac
                    await manager.broadcast_to_mac({
                        "type": "transcript",
                        "content": transcript
                    })
                    
                    # Solo procesar con LLM
                    if transcript:
                        await process_with_llm(transcript)
                elif is_final:
                    logger.info(f"[RT-GO] Skipping duplicate transcript: {transcript[:30]}...")
                    
    except WebSocketDisconnect:
        logger.info("rt_go disconnected")
    finally:
        manager.disconnect_rt_go()


@router.websocket("/mac")
async def mac_endpoint(websocket: WebSocket):
    client_id = f"mac_{id(websocket)}"
    await manager.connect_mac(client_id, websocket)
    
    try:
        await websocket.send_json({
            "type": "connected",
            "message": "Connected to RTAssist"
        })

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)

            if message.get("type") == "transcript":
                transcript = message.get("text", "").strip()
                if transcript:
                    await process_with_llm(transcript)

            elif message.get("type") == "ping":
                await websocket.send_json({"type": "pong"})

    except WebSocketDisconnect:
        logger.info(f"Mac client {client_id} disconnected")
    finally:
        manager.disconnect_mac(client_id)


async def process_with_llm(transcript: str):
    from app.agents.interview_agent import InterviewAgent
    
    logger.info(f"[LLM] Processing transcript: {transcript[:50]}...")
    
    # Enviar señal de "thinking" inmediatamente
    await manager.broadcast_to_mac({
        "type": "thinking",
        "text": ""
    })
    
    agent = InterviewAgent(
        vector_store=manager.vector_store,
        conversation_memory=manager.conversation_memory,
    )
    
    response = await agent.process_transcript(transcript, is_final=True)
    
    logger.info(f"[LLM] Raw response: {response}")
    
    if response:
        logger.info(f"[LLM] Response received: {response[:100]}...")
        # Streaming ultra-rápido: chunks de ~25 caracteres cada 20ms
        # Esto da ~1250 chars/seg = mucho más fluido
        chunk_size = 25
        for i in range(0, len(response), chunk_size):
            chunk = response[i:i + chunk_size]
            await manager.broadcast_to_mac({
                "type": "response",
                "text": chunk
            })
            logger.info(f"[LLM] Sent chunk: {chunk[:20]}...")
            await asyncio.sleep(0.02)  # 20ms entre chunks = más fluido
        logger.info("[LLM] Streaming complete")
    else:
        logger.warning("[LLM] No response generated")