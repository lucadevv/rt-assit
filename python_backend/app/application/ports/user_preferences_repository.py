"""Repository port for user_preferences persistence."""
from abc import ABC, abstractmethod
from typing import Any, Optional

from app.domain.entities.user_preferences import UserPreferences


class UserPreferencesRepository(ABC):
    """Abstract user-preferences store. One row per user (PK=user_id)."""

    @abstractmethod
    def get(self, user_id: str) -> Optional[UserPreferences]:
        """Fetch the prefs row for a user. ``None`` if it doesn't exist."""
        ...

    @abstractmethod
    def upsert(self, prefs: UserPreferences) -> UserPreferences:
        """Insert or replace the prefs row. Returns the persisted entity."""
        ...

    @abstractmethod
    def update_partial(
        self,
        *,
        user_id: str,
        theme: Optional[str] = None,
        density: Optional[str] = None,
        default_layout: Optional[str] = None,
        default_hint_style: Optional[str] = None,
        default_transcript_style: Optional[str] = None,
        default_scenario: Optional[str] = None,
        auto_delete_recordings_days: Optional[int] = None,
        keyboard_shortcuts: Optional[dict[str, Any]] = None,
        audio_device_id: Optional[str] = None,
        audio_device_id_set: bool = False,
        onboarding_complete: Optional[bool] = None,
    ) -> UserPreferences:
        """Patch only the fields provided (None = leave unchanged).

        ``audio_device_id`` admits explicit NULL resets, so it is paired
        with ``audio_device_id_set``: when ``audio_device_id_set`` is True,
        the value of ``audio_device_id`` is written verbatim (including
        None which clears the device); when False, the column is left
        untouched. This sentinel pattern keeps the explicit-reset semantic
        without breaking the "None = unchanged" rule used elsewhere.

        ``onboarding_complete`` is a plain bool (no NULL semantics) — the
        first-run wizard flips it to True once the user finishes (or
        explicitly skips) the flow. ``None`` here means "leave unchanged"
        per the standard sentinel rule.
        """
        ...

    @abstractmethod
    def delete(self, user_id: str) -> bool:
        """Delete the prefs row for a user. Returns True if deleted."""
        ...
