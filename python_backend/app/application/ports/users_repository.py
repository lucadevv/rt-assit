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

    @abstractmethod
    def create_with_password(
        self,
        *,
        user_id: str,
        email: str,
        password_hash: str,
        is_admin: bool,
        name: Optional[str] = None,
    ) -> User:
        """Create a brand-new user with a bcrypt password hash.

        Used by ``AUTH_MODE=custom`` flows (admin user creation). Raises
        a domain ConflictError-equivalent via the underlying integrity
        violation if the email is already taken — callers should pre-check
        with ``get_by_email`` to surface a clean 409."""
        ...

    @abstractmethod
    def get_by_email(self, email: str) -> Optional[User]:
        """Lookup by email. Returns a User WITHOUT exposing password_hash
        (the hash is only readable via ``get_by_email_with_password``)."""
        ...

    @abstractmethod
    def get_by_email_with_password(self, email: str) -> Optional[User]:
        """Lookup by email, INCLUDING the password_hash field.

        Separate from ``get_by_email`` so the password hash is never read
        accidentally — every call site that touches it is auditable."""
        ...

    @abstractmethod
    def set_password_hash(self, user_id: str, password_hash: str) -> User:
        """Replace the user's bcrypt hash. Used by future password-reset
        flows; admin user creation goes through ``create_with_password``."""
        ...
