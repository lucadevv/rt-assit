"""Session-scoped ad-hoc material entity."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional


SessionMaterialType = Literal[
    "brief", "agenda", "objective", "link", "note", "file"
]


@dataclass
class SessionMaterial:
    id: int
    session_id: str
    material_type: SessionMaterialType
    title: Optional[str]
    content: Optional[str]
    source_url: Optional[str]
    created_at: datetime
