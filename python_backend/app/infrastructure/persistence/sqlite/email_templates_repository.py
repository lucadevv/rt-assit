"""SQLite implementation of EmailTemplatesRepository (B8).

Per-language fallback: ``get(id, "en-US")`` falls back to ``"es-419"``
when no exact match exists, so callers always get a renderable result
(or None when no variant exists at all)."""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional

from app.application.ports.email_templates_repository import (
    EmailTemplatesRepository,
)
from app.domain.entities.email_template import EmailTemplate
from app.infrastructure.persistence.sqlite.db import get_conn


_DEFAULT_LANGUAGE = "es-419"


class SQLiteEmailTemplatesRepository(EmailTemplatesRepository):
    def get(
        self, template_id: str, language: str = _DEFAULT_LANGUAGE
    ) -> Optional[EmailTemplate]:
        with get_conn() as conn:
            row = conn.execute(
                """SELECT id, language, subject_template, html_template,
                          text_template, is_active, version, updated_at
                   FROM email_templates
                   WHERE id = ? AND language = ? AND is_active = 1""",
                (template_id, language),
            ).fetchone()
            if row is None and language != _DEFAULT_LANGUAGE:
                row = conn.execute(
                    """SELECT id, language, subject_template, html_template,
                              text_template, is_active, version, updated_at
                       FROM email_templates
                       WHERE id = ? AND language = ? AND is_active = 1""",
                    (template_id, _DEFAULT_LANGUAGE),
                ).fetchone()
        return self._row_to_entity(row) if row else None

    def list_all(self, *, active_only: bool = True) -> list[EmailTemplate]:
        sql = (
            "SELECT id, language, subject_template, html_template, "
            "text_template, is_active, version, updated_at "
            "FROM email_templates"
        )
        if active_only:
            sql += " WHERE is_active = 1"
        sql += " ORDER BY id ASC, language ASC"
        with get_conn() as conn:
            rows = conn.execute(sql).fetchall()
        return [self._row_to_entity(r) for r in rows]

    def upsert(self, template: EmailTemplate) -> EmailTemplate:
        with get_conn() as conn:
            existing = conn.execute(
                """SELECT version FROM email_templates
                   WHERE id = ? AND language = ?""",
                (template.id, template.language),
            ).fetchone()
            new_version = (existing["version"] + 1) if existing else 1
            conn.execute(
                """INSERT INTO email_templates
                   (id, language, subject_template, html_template,
                    text_template, is_active, version, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
                   ON CONFLICT(id, language) DO UPDATE SET
                       subject_template = excluded.subject_template,
                       html_template = excluded.html_template,
                       text_template = excluded.text_template,
                       is_active = excluded.is_active,
                       version = excluded.version,
                       updated_at = excluded.updated_at""",
                (
                    template.id,
                    template.language,
                    template.subject_template,
                    template.html_template,
                    template.text_template,
                    1 if template.is_active else 0,
                    new_version,
                ),
            )
            conn.commit()
            row = conn.execute(
                """SELECT id, language, subject_template, html_template,
                          text_template, is_active, version, updated_at
                   FROM email_templates
                   WHERE id = ? AND language = ?""",
                (template.id, template.language),
            ).fetchone()
        return self._row_to_entity(row)

    @staticmethod
    def _row_to_entity(row: sqlite3.Row) -> EmailTemplate:
        return EmailTemplate(
            id=row["id"],
            language=row["language"],
            subject_template=row["subject_template"],
            html_template=row["html_template"],
            text_template=row["text_template"],
            is_active=bool(row["is_active"]),
            version=row["version"],
            updated_at=_parse_datetime(row["updated_at"]),
        )


def _parse_datetime(value: Optional[str]) -> Optional[datetime]:
    if value is None:
        return None
    normalised = value.replace("T", " ")
    try:
        return datetime.strptime(normalised, "%Y-%m-%d %H:%M:%S")
    except ValueError:
        return datetime.fromisoformat(value)
