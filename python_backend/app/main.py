from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from dotenv import load_dotenv

load_dotenv()

from app.api.websocket import router as ws_router, manager
from app.api import health
from app.memory.vector_store import VectorStore
from app.memory.conversation import ConversationMemory


@asynccontextmanager
async def lifespan(app: FastAPI):
    vector_store = VectorStore()
    conversation_memory = ConversationMemory()
    
    manager.set_dependencies(vector_store, conversation_memory)
    
    app.state.vector_store = vector_store
    app.state.conversation_memory = conversation_memory
    yield
    await vector_store.close()


class WebSocketMiddleware:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            await self.app(scope, receive, send)
        else:
            await self.app(scope, receive, send)


def create_app() -> FastAPI:
    app = FastAPI(
        title="RTAssist API",
        description="AI Interview Assistant Backend",
        version="0.1.0",
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/")
    async def root():
        return {"message": "RTAssist API", "ws": "/ws"}

    app.include_router(health.router, tags=["health"])
    app.include_router(ws_router, prefix="/ws", tags=["websocket"])

    return app


app = create_app()
