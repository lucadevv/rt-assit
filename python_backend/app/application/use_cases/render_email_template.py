"""RenderEmailTemplateUseCase (B8).

Substitutes ``{{var}}`` placeholders in subject/html/text using a
context dict. Missing keys are replaced with empty strings (matches the
B5 ``defaultdict(str)`` behaviour) so partial contexts don't crash a
send. No Jinja2 dependency — the substitution is regex-based + safe."""
from __future__ import annotations

import re
from typing import Any, Optional

from app.application.ports.email_templates_repository import (
    EmailTemplatesRepository,
)
from app.domain.exceptions import NotFoundError


_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_]+)\s*\}\}")


def _substitute(template: str, context: dict[str, Any]) -> str:
    def repl(match: "re.Match[str]") -> str:
        key = match.group(1)
        value = context.get(key, "")
        return str(value) if value is not None else ""

    return _PLACEHOLDER_RE.sub(repl, template)


class RenderEmailTemplateUseCase:
    """Render a stored template into ``(subject, html, text)``."""

    def __init__(self, repo: EmailTemplatesRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        template_id: str,
        context: dict[str, Any],
        language: str = "es-419",
    ) -> tuple[str, str, str]:
        tpl = self.repo.get(template_id, language)
        if tpl is None:
            raise NotFoundError(f"Plantilla de email no encontrada: {template_id}")
        return (
            _substitute(tpl.subject_template, context),
            _substitute(tpl.html_template, context),
            _substitute(tpl.text_template, context),
        )


class DBTemplateRendererCallable:
    """Callable adapter matching the B5 ``TemplateRenderer`` callable shape
    (``renderer(name, context) -> (subject, html, text)``).

    Lets the existing B5 ``Send*EmailUseCase`` instances work unchanged
    against the new DB-backed template store. The fallback path uses the
    in-memory ``infrastructure/email/templates.py`` source so a missing
    DB row never breaks the email pipeline."""

    def __init__(
        self,
        *,
        repo: EmailTemplatesRepository,
        fallback_renderer: Optional[Any] = None,
        language: str = "es-419",
    ) -> None:
        self.repo = repo
        self.fallback = fallback_renderer
        self.language = language

    def __call__(
        self, name: str, context: dict[str, Any]
    ) -> tuple[str, str, str]:
        tpl = self.repo.get(name, self.language)
        if tpl is None:
            if self.fallback is not None:
                # Legacy hardcoded templates use ``str.format`` — keep that
                # path alive so we never silently drop an email send.
                return self.fallback(name, context)
            raise NotFoundError(f"Plantilla de email no encontrada: {name}")
        return (
            _substitute(tpl.subject_template, context),
            _substitute(tpl.html_template, context),
            _substitute(tpl.text_template, context),
        )
