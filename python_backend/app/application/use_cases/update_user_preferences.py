"""UpdateUserPreferences — partial patch of user prefs.

B4 — supports ``audio_device_id`` (FR-49 audio device persistence).
The field admits explicit NULL resets, so the use case threads a
``audio_device_id_set`` flag down to the repository to distinguish
"omitted from the request" from "explicitly cleared to None".
"""
import logging
from typing import Any, Optional

from app.application.ports.user_preferences_repository import (
    UserPreferencesRepository,
)
from app.domain.entities.user_preferences import (
    UserPreferences,
    VALID_DENSITIES,
    VALID_HINT_STYLES,
    VALID_LAYOUTS,
    VALID_THEMES,
    VALID_TRANSCRIPT_STYLES,
)
from app.domain.exceptions import ValidationError


logger = logging.getLogger(__name__)


# Sentinel for "field not present in request" — distinct from None which
# means "explicit clear to NULL". Exposed at module level so callers (the
# presentation router) can reuse the SAME object, since the check is by
# identity (``is UNSET``).
UNSET: Any = object()
# Internal alias — keeps existing references inside this module readable.
_UNSET = UNSET


class UpdateUserPreferencesUseCase:
    """Partial update of UserPreferences with domain-level validation."""

    def __init__(self, preferences_repo: UserPreferencesRepository) -> None:
        self.preferences_repo = preferences_repo

    def execute(
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
        audio_device_id: Any = UNSET,
        onboarding_complete: Optional[bool] = None,
    ) -> UserPreferences:
        if theme is not None and theme not in VALID_THEMES:
            raise ValidationError(f"Tema inválido: {theme}")
        if density is not None and density not in VALID_DENSITIES:
            raise ValidationError(f"Densidad inválida: {density}")
        if default_layout is not None and default_layout not in VALID_LAYOUTS:
            raise ValidationError(f"Layout inválido: {default_layout}")
        if default_hint_style is not None and default_hint_style not in VALID_HINT_STYLES:
            raise ValidationError(f"Estilo de hint inválido: {default_hint_style}")
        if (
            default_transcript_style is not None
            and default_transcript_style not in VALID_TRANSCRIPT_STYLES
        ):
            raise ValidationError(
                f"Estilo de transcript inválido: {default_transcript_style}"
            )
        if (
            auto_delete_recordings_days is not None
            and auto_delete_recordings_days < 0
        ):
            raise ValidationError(
                "auto_delete_recordings_days no puede ser negativo"
            )

        # audio_device_id: any non-empty string OR None (reset). Empty
        # string is invalid — clients should send null to reset.
        audio_device_id_set = audio_device_id is not _UNSET
        audio_device_value: Optional[str] = None
        if audio_device_id_set:
            if audio_device_id is None:
                audio_device_value = None
            else:
                if not isinstance(audio_device_id, str):
                    raise ValidationError(
                        "audio_device_id debe ser string o null"
                    )
                if audio_device_id.strip() == "":
                    raise ValidationError(
                        "audio_device_id no puede ser cadena vacía"
                    )
                audio_device_value = audio_device_id

        # Lightweight audit (B4 requirement — INFO log only for now).
        changed_fields = [
            name
            for name, value in (
                ("theme", theme),
                ("density", density),
                ("default_layout", default_layout),
                ("default_hint_style", default_hint_style),
                ("default_transcript_style", default_transcript_style),
                ("default_scenario", default_scenario),
                ("auto_delete_recordings_days", auto_delete_recordings_days),
                ("keyboard_shortcuts", keyboard_shortcuts),
            )
            if value is not None
        ]
        if audio_device_id_set:
            changed_fields.append("audio_device_id")
        if onboarding_complete is not None:
            changed_fields.append("onboarding_complete")
        if changed_fields:
            logger.info(
                "preferences.updated user_id=%s fields=%s",
                user_id,
                ",".join(changed_fields),
            )

        return self.preferences_repo.update_partial(
            user_id=user_id,
            theme=theme,
            density=density,
            default_layout=default_layout,
            default_hint_style=default_hint_style,
            default_transcript_style=default_transcript_style,
            default_scenario=default_scenario,
            auto_delete_recordings_days=auto_delete_recordings_days,
            keyboard_shortcuts=keyboard_shortcuts,
            audio_device_id=audio_device_value,
            audio_device_id_set=audio_device_id_set,
            onboarding_complete=onboarding_complete,
        )
