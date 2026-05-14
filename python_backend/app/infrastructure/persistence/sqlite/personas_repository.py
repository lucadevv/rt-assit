"""SQLite implementation of PersonasRepository.

All queries are parameterised (``?`` placeholders) — never string-concat
user-controlled values. Ownership checks are enforced at the query level
(every read/write uses ``user_id = ?``) so a user can't accidentally
see or mutate another user's personas.

Link table (``persona_documents``) requires a pre-insert ownership check
on the document because there's no ``user_id`` column on the link table —
the only way to enforce authz is to look up the doc's owner first.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Any, Optional

from app.application.ports.personas_repository import PersonasRepository
from app.domain.entities.persona import Persona, PersonaTone
from app.domain.exceptions import NotFoundError
from app.infrastructure.persistence.sqlite.db import get_conn


def _parse_dt(value: Optional[str]) -> datetime:
    """SQLite stores datetimes as ISO strings via ``datetime('now')``.

    Tolerates both the canonical ``YYYY-MM-DD HH:MM:SS`` form (SQLite's
    default) and ISO-with-T (in case some other path inserts via Python's
    ``datetime.isoformat()``)."""
    if value is None:
        return datetime.utcnow()
    try:
        return datetime.fromisoformat(value.replace(" ", "T"))
    except ValueError:
        return datetime.utcnow()


class SQLitePersonasRepository(PersonasRepository):
    """Concrete SQLite-backed personas repository."""

    # -------------------- personas CRUD --------------------

    def create(
        self,
        *,
        user_id: str,
        name: str,
        description: Optional[str] = None,
        scenario_id: Optional[str] = None,
        icon: Optional[str] = None,
        tone: Optional[PersonaTone] = None,
        custom_instructions: Optional[str] = None,
        is_default: bool = False,
    ) -> Persona:
        with get_conn() as conn:
            if is_default:
                # Single-default invariant — clear any previous default
                # for this user inside the same transaction.
                conn.execute(
                    "UPDATE personas SET is_default = 0 WHERE user_id = ?",
                    (user_id,),
                )
            cur = conn.execute(
                """INSERT INTO personas
                   (user_id, name, description, scenario_id, icon, tone,
                    custom_instructions, is_default)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_id,
                    name,
                    description,
                    scenario_id,
                    icon,
                    tone,
                    custom_instructions,
                    1 if is_default else 0,
                ),
            )
            conn.commit()
            row_id = cur.lastrowid
            if row_id is None:
                raise RuntimeError("failed to insert persona")

        persona = self.get(int(row_id), user_id=user_id)
        if persona is None:
            raise RuntimeError("failed to read back inserted persona")
        return persona

    def get(self, persona_id: int, *, user_id: str) -> Optional[Persona]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM personas WHERE id = ? AND user_id = ?",
                (persona_id, user_id),
            ).fetchone()
        return self._row_to_persona(row) if row else None

    def get_default(self, user_id: str) -> Optional[Persona]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM personas WHERE user_id = ? AND is_default = 1 "
                "LIMIT 1",
                (user_id,),
            ).fetchone()
        return self._row_to_persona(row) if row else None

    def list_for_user(self, user_id: str) -> list[Persona]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM personas WHERE user_id = ? "
                "ORDER BY is_default DESC, created_at DESC",
                (user_id,),
            ).fetchall()
        return [self._row_to_persona(r) for r in rows]

    def update(
        self,
        *,
        persona_id: int,
        user_id: str,
        name: Optional[str] = None,
        description: Optional[str] = None,
        scenario_id: Optional[str] = None,
        icon: Optional[str] = None,
        tone: Optional[PersonaTone] = None,
        custom_instructions: Optional[str] = None,
    ) -> Persona:
        sets: list[str] = []
        params: list[Any] = []
        if name is not None:
            sets.append("name = ?")
            params.append(name)
        if description is not None:
            sets.append("description = ?")
            params.append(description)
        if scenario_id is not None:
            sets.append("scenario_id = ?")
            params.append(scenario_id)
        if icon is not None:
            sets.append("icon = ?")
            params.append(icon)
        if tone is not None:
            sets.append("tone = ?")
            params.append(tone)
        if custom_instructions is not None:
            sets.append("custom_instructions = ?")
            params.append(custom_instructions)

        if sets:
            sets.append("updated_at = datetime('now')")
            params.extend([persona_id, user_id])
            with get_conn() as conn:
                cur = conn.execute(
                    f"UPDATE personas SET {', '.join(sets)} "
                    "WHERE id = ? AND user_id = ?",
                    params,
                )
                conn.commit()
                if cur.rowcount == 0:
                    raise NotFoundError(f"persona {persona_id} no encontrada")

        persona = self.get(persona_id, user_id=user_id)
        if persona is None:
            raise NotFoundError(f"persona {persona_id} no encontrada")
        return persona

    def set_default(self, persona_id: int, *, user_id: str) -> Persona:
        """Mark this persona as default for user. Transactional: clears
        any previous default first, then promotes the target."""
        with get_conn() as conn:
            # Validate ownership BEFORE mutating.
            row = conn.execute(
                "SELECT id FROM personas WHERE id = ? AND user_id = ?",
                (persona_id, user_id),
            ).fetchone()
            if row is None:
                raise NotFoundError(f"persona {persona_id} no encontrada")

            conn.execute(
                "UPDATE personas SET is_default = 0 WHERE user_id = ?",
                (user_id,),
            )
            conn.execute(
                "UPDATE personas SET is_default = 1, "
                "updated_at = datetime('now') "
                "WHERE id = ? AND user_id = ?",
                (persona_id, user_id),
            )
            conn.commit()

        persona = self.get(persona_id, user_id=user_id)
        if persona is None:
            raise NotFoundError(f"persona {persona_id} no encontrada")
        return persona

    def delete(self, persona_id: int, *, user_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                "DELETE FROM personas WHERE id = ? AND user_id = ?",
                (persona_id, user_id),
            )
            conn.commit()
            return cur.rowcount > 0

    # -------------------- persona_documents M2M --------------------

    def link_document(
        self,
        *,
        persona_id: int,
        document_id: int,
        is_identity: bool,
        user_id: str,
    ) -> None:
        """Link a document to a persona, enforcing ownership.

        Both rows (persona and document) must belong to ``user_id`` —
        otherwise raise PermissionError so the use case can translate to
        404 (we don't want to leak the existence of other users' rows)."""
        with get_conn() as conn:
            persona_owner = conn.execute(
                "SELECT user_id FROM personas WHERE id = ?", (persona_id,)
            ).fetchone()
            if persona_owner is None or persona_owner["user_id"] != user_id:
                raise PermissionError(
                    f"persona {persona_id} no pertenece al usuario"
                )

            doc_owner = conn.execute(
                "SELECT user_id FROM documents WHERE id = ?", (document_id,)
            ).fetchone()
            if doc_owner is None or doc_owner["user_id"] != user_id:
                raise PermissionError(
                    f"document {document_id} no pertenece al usuario"
                )

            # Idempotent insert — re-linking with a different is_identity
            # flag should update (UPSERT) rather than fail.
            conn.execute(
                """INSERT INTO persona_documents
                   (persona_id, document_id, is_identity)
                   VALUES (?, ?, ?)
                   ON CONFLICT(persona_id, document_id)
                   DO UPDATE SET is_identity = excluded.is_identity""",
                (persona_id, document_id, 1 if is_identity else 0),
            )
            conn.commit()

    def unlink_document(
        self,
        *,
        persona_id: int,
        document_id: int,
        user_id: str,
    ) -> bool:
        with get_conn() as conn:
            persona_owner = conn.execute(
                "SELECT user_id FROM personas WHERE id = ?", (persona_id,)
            ).fetchone()
            if persona_owner is None or persona_owner["user_id"] != user_id:
                return False

            cur = conn.execute(
                "DELETE FROM persona_documents "
                "WHERE persona_id = ? AND document_id = ?",
                (persona_id, document_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def list_documents(
        self,
        *,
        persona_id: int,
        user_id: str,
        is_identity: Optional[bool] = None,
    ) -> list[int]:
        with get_conn() as conn:
            owner = conn.execute(
                "SELECT user_id FROM personas WHERE id = ?", (persona_id,)
            ).fetchone()
            if owner is None or owner["user_id"] != user_id:
                return []

            query = (
                "SELECT document_id FROM persona_documents "
                "WHERE persona_id = ?"
            )
            params: list[Any] = [persona_id]
            if is_identity is not None:
                query += " AND is_identity = ?"
                params.append(1 if is_identity else 0)
            rows = conn.execute(query, params).fetchall()
        return [int(r["document_id"]) for r in rows]

    # -------------------- helpers --------------------

    @staticmethod
    def _row_to_persona(row: sqlite3.Row) -> Persona:
        return Persona(
            id=int(row["id"]),
            user_id=row["user_id"],
            name=row["name"],
            description=row["description"],
            scenario_id=row["scenario_id"],
            icon=row["icon"],
            tone=row["tone"],
            custom_instructions=row["custom_instructions"],
            is_default=bool(row["is_default"]),
            created_at=_parse_dt(row["created_at"]),
            updated_at=_parse_dt(row["updated_at"]),
        )
