"""Repository port for email-template persistence (B8).

DB-backed templates (replacing the B5 hardcoded ``templates.py``).
Supports per-language fallback: caller asks for ``("welcome", "es-419")``;
implementations return either an exact-language match or the active
default-language row, never None when at least one variant exists."""
from __future__ import annotations

from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.email_template import EmailTemplate


class EmailTemplatesRepository(ABC):
    @abstractmethod
    def get(
        self, template_id: str, language: str = "es-419"
    ) -> Optional[EmailTemplate]:
        """Return the active template for ``id`` + ``language`` if any.

        Implementations should fall back to the default language when no
        exact match is found."""
        ...

    @abstractmethod
    def list_all(self, *, active_only: bool = True) -> list[EmailTemplate]:
        """List all templates (admin/dev visibility)."""
        ...

    @abstractmethod
    def upsert(self, template: EmailTemplate) -> EmailTemplate:
        """Insert or update by ``(id, language)``. Bumps ``version`` and
        ``updated_at``."""
        ...
