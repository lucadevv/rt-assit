"""UpdateUserSettings — patch profile fields (name, language)."""
from typing import Optional

from app.application.ports.users_repository import UsersRepository
from app.domain.entities.user import User


class UpdateUserSettingsUseCase:
    """Update the user's editable profile fields."""

    def __init__(self, users_repo: UsersRepository) -> None:
        self.users_repo = users_repo

    def execute(
        self,
        *,
        user_id: str,
        name: Optional[str] = None,
        language_preferred: Optional[str] = None,
    ) -> User:
        return self.users_repo.update_settings(
            user_id=user_id,
            name=name,
            language_preferred=language_preferred,
        )
