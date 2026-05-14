"""Repository port for session-tag persistence (B1)."""
from abc import ABC, abstractmethod


class SessionTagsRepository(ABC):
    @abstractmethod
    def add_tag(self, *, session_id: str, tag: str) -> None:
        """Idempotent — INSERT OR IGNORE."""
        ...

    @abstractmethod
    def remove_tag(self, *, session_id: str, tag: str) -> bool: ...

    @abstractmethod
    def list_tags(self, session_id: str) -> list[str]: ...
