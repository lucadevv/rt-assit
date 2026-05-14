"""GetEmailTemplateUseCase (B8)."""
from __future__ import annotations

from typing import Optional

from app.application.ports.email_templates_repository import (
    EmailTemplatesRepository,
)
from app.domain.entities.email_template import EmailTemplate


class GetEmailTemplateUseCase:
    def __init__(self, repo: EmailTemplatesRepository) -> None:
        self.repo = repo

    def execute(
        self, *, template_id: str, language: str = "es-419"
    ) -> Optional[EmailTemplate]:
        return self.repo.get(template_id, language)
