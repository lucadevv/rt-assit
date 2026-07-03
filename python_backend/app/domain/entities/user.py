"""User domain entity.

Pure data — no framework or infrastructure dependencies. The id is a string
because it comes from Clerk (e.g. ``user_2abcXYZ``) or a synthetic dev id."""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional

UserTier = Literal["free", "pro", "premium", "byok"]

VALID_TIERS: set[str] = {"free", "pro", "premium", "byok"}


@dataclass
class User:
    """A registered user. ``id`` is the Clerk user id (or ``dev_default``
    in dev mode). Multi-tenant invariant: every user-owned row in the DB
    references this id."""

    id: str
    email: str
    name: Optional[str]
    avatar_url: Optional[str]
    tier: UserTier
    language_preferred: str
    created_at: datetime
    updated_at: datetime
    password_hash: Optional[str] = None
    is_admin: bool = False
