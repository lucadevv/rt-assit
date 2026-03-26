from dataclasses import dataclass, field
from datetime import datetime
from typing import Any


@dataclass
class Message:
    role: str
    content: str
    timestamp: datetime = field(default_factory=datetime.now)


class ConversationMemory:
    def __init__(self, max_messages: int = 50):
        self.max_messages = max_messages
        self.sessions: dict[str, list[Message]] = {}

    def add_message(self, session_id: str, role: str, content: str):
        if session_id not in self.sessions:
            self.sessions[session_id] = []

        self.sessions[session_id].append(Message(role=role, content=content))

        if len(self.sessions[session_id]) > self.max_messages:
            self.sessions[session_id] = self.sessions[session_id][-self.max_messages:]

    def get_conversation(self, session_id: str) -> list[dict[str, Any]]:
        session = self.sessions.get(session_id, [])
        return [
            {"role": m.role, "content": m.content, "timestamp": m.timestamp.isoformat()}
            for m in session
        ]

    def clear(self, session_id: str):
        self.sessions.pop(session_id, None)

    def get_recent(self, session_id: str, n: int = 10) -> list[Message]:
        session = self.sessions.get(session_id, [])
        return session[-n:]
