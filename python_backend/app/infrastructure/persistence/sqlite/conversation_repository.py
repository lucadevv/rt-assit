"""In-memory conversation repository.

Lives under sqlite/ for now because the eventual plan is SQLite-backed; current
implementation keeps state in process memory (matches previous behaviour exactly).
"""
import logging
from typing import Optional

from app.application.ports.conversation_repository import ConversationRepository
from app.domain.entities.conversation import Hint, Question


logger = logging.getLogger(__name__)


class InMemoryConversationRepository(ConversationRepository):
    """Process-local conversation memory. Cleared on container restart.

    Matches the previous ConversationMemory class behaviour 1:1."""

    def __init__(self, max_per_session: int = 30) -> None:
        self.max_per_session = max_per_session
        self.questions: dict[str, list[Question]] = {}
        self.hints: dict[str, list[Hint]] = {}

    def add_question(self, session_id: str, text: str) -> None:
        bucket = self.questions.setdefault(session_id, [])
        bucket.append(Question(text=text))
        if len(bucket) > self.max_per_session:
            self.questions[session_id] = bucket[-self.max_per_session :]

    def add_hint(
        self,
        session_id: str,
        text: str,
        related_question: Optional[str] = None,
    ) -> None:
        bucket = self.hints.setdefault(session_id, [])
        bucket.append(Hint(text=text, related_question=related_question))
        if len(bucket) > self.max_per_session:
            self.hints[session_id] = bucket[-self.max_per_session :]

    def get_recent_questions(self, session_id: str, n: int = 5) -> list[Question]:
        return self.questions.get(session_id, [])[-n:]

    def get_recent_hints(self, session_id: str, n: int = 5) -> list[Hint]:
        return self.hints.get(session_id, [])[-n:]

    def clear(self, session_id: str) -> None:
        self.questions.pop(session_id, None)
        self.hints.pop(session_id, None)
