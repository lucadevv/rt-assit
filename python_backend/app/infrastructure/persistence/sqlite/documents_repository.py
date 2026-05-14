"""SQLite implementation of DocumentsRepository."""
import json
import sqlite3
from typing import Any, Optional

from app.application.ports.documents_repository import DocumentsRepository
from app.domain.entities.document import Document
from app.infrastructure.persistence.sqlite.db import get_conn


class SQLiteDocumentsRepository(DocumentsRepository):
    """Concrete SQLite-backed documents repository.

    Translates SQL rows to Document domain entities at the boundary."""

    def add(
        self,
        user_id: str,
        doc_type: str,
        title: str,
        content: str,
        scenario: Optional[str] = None,
        source: Optional[str] = None,
        metadata: Optional[dict[str, Any]] = None,
    ) -> int:
        # is_primary defaults to 0 (column has NOT NULL DEFAULT 0). The
        # PATCH endpoint is the only place that can promote a doc to
        # primary, so INSERT never sets it.
        with get_conn() as conn:
            cur = conn.execute(
                """INSERT INTO documents
                   (user_id, doc_type, scenario, title, content, source, metadata)
                   VALUES (?, ?, ?, ?, ?, ?, ?)""",
                (
                    user_id,
                    doc_type,
                    scenario,
                    title,
                    content,
                    source,
                    json.dumps(metadata or {}),
                ),
            )
            conn.commit()
            row_id = cur.lastrowid
            if row_id is None:
                raise RuntimeError("failed to insert document")
            return int(row_id)

    def list(
        self,
        user_id: str,
        scenario: Optional[str] = None,
        doc_type: Optional[str] = None,
        include_global: bool = True,
    ) -> list[Document]:
        """Returns docs for user. If scenario given, includes scenario docs +
        globals (scenario IS NULL) when include_global=True."""
        query = "SELECT * FROM documents WHERE user_id = ?"
        params: list[Any] = [user_id]

        if scenario is not None:
            if include_global:
                query += " AND (scenario = ? OR scenario IS NULL)"
                params.append(scenario)
            else:
                query += " AND scenario = ?"
                params.append(scenario)

        if doc_type is not None:
            query += " AND doc_type = ?"
            params.append(doc_type)

        # Wave 2A: primary docs first within each (user, scenario) so the
        # PromptBuilder identity-layer sees the curated CV before any
        # other identity docs. Tie-break by uploaded_at DESC (most recent
        # wins) so the prior behaviour is preserved for non-primary docs.
        query += " ORDER BY is_primary DESC, uploaded_at DESC"

        with get_conn() as conn:
            rows = conn.execute(query, params).fetchall()

        return [self._row_to_document(r) for r in rows]

    def get(self, doc_id: int, user_id: str) -> Optional[Document]:
        with get_conn() as conn:
            row = conn.execute(
                "SELECT * FROM documents WHERE id = ? AND user_id = ?",
                (doc_id, user_id),
            ).fetchone()
        return self._row_to_document(row) if row else None

    def delete(self, doc_id: int, user_id: str) -> bool:
        with get_conn() as conn:
            cur = conn.execute(
                "DELETE FROM documents WHERE id = ? AND user_id = ?",
                (doc_id, user_id),
            )
            conn.commit()
            return cur.rowcount > 0

    def update(
        self,
        doc_id: int,
        user_id: str,
        title: Optional[str] = None,
        content: Optional[str] = None,
        is_primary: Optional[bool] = None,
    ) -> Optional[Document]:
        sets: list[str] = []
        params: list[Any] = []
        if title is not None:
            sets.append("title = ?")
            params.append(title)
        if content is not None:
            sets.append("content = ?")
            params.append(content)
        if is_primary is not None:
            # SQLite has no native bool — store as 0/1 INTEGER.
            sets.append("is_primary = ?")
            params.append(1 if is_primary else 0)
        if not sets:
            return self.get(doc_id, user_id)
        params.extend([doc_id, user_id])
        with get_conn() as conn:
            conn.execute(
                f"UPDATE documents SET {', '.join(sets)} WHERE id = ? AND user_id = ?",
                params,
            )
            conn.commit()
        return self.get(doc_id, user_id)

    def unmark_primary_for_scope(
        self,
        *,
        user_id: str,
        scenario_id: Optional[str],
        identity_doc_types: set[str],
        exclude_doc_id: Optional[int] = None,
    ) -> None:
        """Clear ``is_primary`` for every other doc in the same scope.

        Scope: (user_id, scenario_id OR scenario IS NULL) AND
        doc_type IN identity_doc_types AND id != exclude_doc_id. Runs in a
        single UPDATE so the single-primary invariant flips atomically.
        Idempotent — safe to call even when no rows match.
        """
        if not identity_doc_types:
            return

        placeholders = ",".join("?" * len(identity_doc_types))
        params: list[Any] = [user_id]

        if scenario_id is None:
            scenario_clause = "scenario IS NULL"
        else:
            # Include the scenario-specific docs AND the user-global docs
            # (scenario IS NULL) so promoting an identity doc inside a
            # scenario also unmarks any global identity doc that was
            # previously primary — preserves "at most one primary per
            # (user, scenario_id) within identity docs".
            scenario_clause = "(scenario = ? OR scenario IS NULL)"
            params.append(scenario_id)

        params.extend(identity_doc_types)

        query = (
            "UPDATE documents SET is_primary = 0 "
            f"WHERE user_id = ? AND {scenario_clause} "
            f"AND doc_type IN ({placeholders}) "
            "AND is_primary = 1"
        )

        if exclude_doc_id is not None:
            query += " AND id != ?"
            params.append(exclude_doc_id)

        with get_conn() as conn:
            conn.execute(query, params)
            conn.commit()

    @staticmethod
    def _row_to_document(row: sqlite3.Row) -> Document:
        # ``is_primary`` may be absent if a very old row sneaks in before
        # the Wave 2A migration runs — defensive ``row.keys()`` lookup
        # keeps the boundary tolerant.
        try:
            is_primary_raw = row["is_primary"]
        except (IndexError, KeyError):
            is_primary_raw = 0
        return Document(
            id=row["id"],
            user_id=row["user_id"],
            doc_type=row["doc_type"],
            scenario=row["scenario"],
            title=row["title"] or "",
            content=row["content"],
            source=row["source"],
            metadata=json.loads(row["metadata"] or "{}"),
            uploaded_at=row["uploaded_at"],
            is_primary=bool(is_primary_raw),
        )
