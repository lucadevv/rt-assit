"""SQLite implementation of SessionMaterialsRepository.

Authz note: this repo intentionally does NOT take a user_id parameter —
the use case is expected to validate session ownership via
SessionsRepository BEFORE delegating here. That keeps the data model
honest (materials belong to a session, not a user) while the use case
enforces the access-control boundary.
"""
from __future__ import annotations

import sqlite3
from datetime import datetime
from typing import Optional

from app.application.ports.session_materials_repository import (
    SessionMaterialsRepository,
)
from app.domain.entities.session_material import (
    SessionMaterial,
    SessionMaterialType,
)
from app.infrastructure.persistence.sqlite.db import get_conn


def _parse_dt(value: Optional[str]) -> datetime:
    if value is None:
        return datetime.utcnow()
    try:
        return datetime.fromisoformat(value.replace(" ", "T"))
    except ValueError:
        return datetime.utcnow()


class SQLiteSessionMaterialsRepository(SessionMaterialsRepository):
    """Concrete SQLite-backed session-materials repository."""

    def create(
        self,
        *,
        session_id: str,
        material_type: SessionMaterialType,
        title: Optional[str] = None,
        content: Optional[str] = None,
        source_url: Optional[str] = None,
    ) -> SessionMaterial:
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO session_materials
                   (session_id, material_type, title, content, source_url)
                   VALUES (?, ?, ?, ?, ?)""",
                (session_id, material_type, title, content, source_url),
            )
            conn.commit()
            row_id = cur.lastrowid
            if row_id is None:
                raise RuntimeError("failed to insert session_material")

            row = conn.execute(
                "SELECT * FROM session_materials WHERE id = ?",
                (int(row_id),),
            ).fetchone()
        if row is None:
            raise RuntimeError("failed to read back inserted material")
        return self._row_to_material(row)

    def list_for_session(self, session_id: str) -> list[SessionMaterial]:
        with get_conn() as conn:
            rows = conn.execute(
                "SELECT * FROM session_materials "
                "WHERE session_id = ? "
                "ORDER BY created_at ASC",
                (session_id,),
            ).fetchall()
        return [self._row_to_material(r) for r in rows]

    def delete(self, material_id: int, *, session_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                "DELETE FROM session_materials "
                "WHERE id = ? AND session_id = ?",
                (material_id, session_id),
            )
            conn.commit()
            return cur.rowcount > 0

    @staticmethod
    def _row_to_material(row: sqlite3.Row) -> SessionMaterial:
        return SessionMaterial(
            id=int(row["id"]),
            session_id=row["session_id"],
            material_type=row["material_type"],
            title=row["title"],
            content=row["content"],
            source_url=row["source_url"],
            created_at=_parse_dt(row["created_at"]),
        )
