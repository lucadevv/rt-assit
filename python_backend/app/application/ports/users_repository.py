"""Repository port for users persistence."""
from abc import ABC, abstractmethod
from typing import Optional

from app.domain.entities.user import User, UserTier


class UsersRepository(ABC):
    """Abstract users store. Implementations: SQLite (current), Postgres (future)."""

    @abstractmethod
    def get_by_id(self, user_id: str) -> Optional[User]:
        """Fetch a user by id."""
        ...

    @abstractmethod
    def upsert(
        self,
        *,
        user_id: str,
        email: str,
        name: Optional[str],
        avatar_url: Optional[str],
    ) -> User:
        """Idempotent insert — creates or updates email/name/avatar.

        Tier is preserved on update (admin-only via ``update_tier``)."""
        ...

    @abstractmethod
    def update_settings(
        self,
        *,
        user_id: str,
        name: Optional[str],
        language_preferred: Optional[str],
    ) -> User:
        """Patch profile fields (name, language). Returns the updated user."""
        ...

    @abstractmethod
    def update_tier(self, *, user_id: str, tier: UserTier) -> User:
        """Set the user's tier (called by billing webhooks in B5)."""
        ...

    @abstractmethod
    def update_name(self, *, user_id: str, name: str) -> User:
        """Set the user's display name. Used by the identity-name extractor
        when a CV / profile / LinkedIn / bio is uploaded and the user has
        no real name on record yet."""
        ...

    @abstractmethod
    def delete(self, user_id: str) -> bool:
        """Delete a user by id. Returns True if deleted.

        Cascades to user_preferences via FK ON DELETE CASCADE.
        documents are not cascaded (kept for audit / 7-year billing retention);
        callers must orchestrate full GDPR delete via use case."""
        ...
