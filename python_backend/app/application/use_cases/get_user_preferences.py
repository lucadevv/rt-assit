"""GetUserPreferences — fetch (or initialise default) prefs for a user."""
from app.application.ports.user_preferences_repository import (
    UserPreferencesRepository,
)
from app.domain.entities.user_preferences import UserPreferences


class GetUserPreferencesUseCase:
    """Fetch prefs, falling back to a fresh default-prefs entity if missing.

    Does NOT persist the default — callers can read defaults without writing."""

    def __init__(self, preferences_repo: UserPreferencesRepository) -> None:
        self.preferences_repo = preferences_repo

    def execute(self, *, user_id: str) -> UserPreferences:
        prefs = self.preferences_repo.get(user_id)
        if prefs is None:
            return UserPreferences(user_id=user_id)
        return prefs
