"""User-account REST endpoints (B0 + B4).

Routes:
  GET    /api/me            — current user (creates row on first sign-in)
  PATCH  /api/me            — update profile (name, language)
  DELETE /api/me            — GDPR delete (user + prefs + documents)
  GET    /api/preferences   — current prefs (defaults if missing)
  PATCH  /api/preferences   — partial patch of prefs (B4: audio_device_id)
  GET    /api/integrations  — list third-party integrations (B4 placeholder)

All routes require auth via `get_current_user` (dev mode synthesises a default
user when AUTH_MODE=dev and no header is present)."""
from typing import Any

from fastapi import APIRouter, Depends, HTTPException

from app.application.use_cases.delete_user_data import DeleteUserDataUseCase
from app.application.use_cases.get_user_preferences import GetUserPreferencesUseCase
from app.application.use_cases.list_integrations import ListIntegrationsUseCase
from app.application.use_cases.update_user_preferences import (
    UNSET as PREFS_UNSET,
    UpdateUserPreferencesUseCase,
)
from app.application.use_cases.update_user_settings import UpdateUserSettingsUseCase
from app.domain.entities.user import User
from app.domain.exceptions import ValidationError
from app.presentation.api.schemas import (
    DeleteResponse,
    IntegrationResponse,
    UpdateMeRequest,
    UpdatePreferencesRequest,
    UserPreferencesResponse,
    UserResponse,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_delete_user_data_use_case,
    get_get_user_preferences_use_case,
    get_list_integrations_use_case,
    get_update_user_preferences_use_case,
    get_update_user_settings_use_case,
)


router = APIRouter()


@router.get("/api/me", response_model=UserResponse)
async def get_me(user: User = Depends(get_current_user)) -> UserResponse:
    return UserResponse.from_domain(user)


@router.patch("/api/me", response_model=UserResponse)
async def update_me(
    body: UpdateMeRequest,
    user: User = Depends(get_current_user),
    use_case: UpdateUserSettingsUseCase = Depends(get_update_user_settings_use_case),
) -> UserResponse:
    updated = use_case.execute(
        user_id=user.id,
        name=body.name,
        language_preferred=body.language_preferred,
    )
    return UserResponse.from_domain(updated)


@router.delete("/api/me", response_model=DeleteResponse)
async def delete_me(
    user: User = Depends(get_current_user),
    use_case: DeleteUserDataUseCase = Depends(get_delete_user_data_use_case),
) -> DeleteResponse:
    deleted = use_case.execute(user_id=user.id)
    return DeleteResponse(deleted=deleted)


@router.get("/api/preferences", response_model=UserPreferencesResponse)
async def get_preferences(
    user: User = Depends(get_current_user),
    use_case: GetUserPreferencesUseCase = Depends(
        get_get_user_preferences_use_case
    ),
) -> UserPreferencesResponse:
    prefs = use_case.execute(user_id=user.id)
    return UserPreferencesResponse.from_domain(prefs)


@router.patch("/api/preferences", response_model=UserPreferencesResponse)
async def update_preferences(
    body: UpdatePreferencesRequest,
    user: User = Depends(get_current_user),
    use_case: UpdateUserPreferencesUseCase = Depends(
        get_update_user_preferences_use_case
    ),
) -> UserPreferencesResponse:
    # audio_device_id admits explicit null resets, so we must distinguish
    # "field omitted from JSON" from "field present with value null". In
    # Pydantic v2 ``model_fields_set`` carries the names of the fields the
    # client actually sent — only those should be propagated as explicit.
    # PREFS_UNSET is the SAME sentinel object the use case checks against
    # via ``is``, so identity comparison works across the layer boundary.
    audio_device_id_arg: Any = PREFS_UNSET
    if "audio_device_id" in body.model_fields_set:
        audio_device_id_arg = body.audio_device_id

    try:
        prefs = use_case.execute(
            user_id=user.id,
            theme=body.theme,
            density=body.density,
            default_layout=body.default_layout,
            default_hint_style=body.default_hint_style,
            default_transcript_style=body.default_transcript_style,
            default_scenario=body.default_scenario,
            auto_delete_recordings_days=body.auto_delete_recordings_days,
            keyboard_shortcuts=body.keyboard_shortcuts,
            audio_device_id=audio_device_id_arg,
            onboarding_complete=body.onboarding_complete,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return UserPreferencesResponse.from_domain(prefs)


@router.post("/api/me/onboarding/complete", response_model=UserPreferencesResponse)
async def mark_onboarding_complete(
    user: User = Depends(get_current_user),
    use_case: UpdateUserPreferencesUseCase = Depends(
        get_update_user_preferences_use_case
    ),
) -> UserPreferencesResponse:
    """Idempotently flip ``onboarding_complete=True`` for the current user.

    The /app/onboarding wizard calls this on finish or explicit skip so the
    ``(app)/layout.tsx`` redirect stops firing on subsequent logins. Safe
    to call multiple times — the underlying UPDATE is a no-op once the
    flag is True."""
    prefs = use_case.execute(user_id=user.id, onboarding_complete=True)
    return UserPreferencesResponse.from_domain(prefs)


@router.get("/api/integrations", response_model=list[IntegrationResponse])
async def list_integrations(
    user: User = Depends(get_current_user),
    use_case: ListIntegrationsUseCase = Depends(get_list_integrations_use_case),
) -> list[IntegrationResponse]:
    """Return the user's third-party integrations (FR-51 placeholder).

    Currently returns an empty list for every user — no provider has been
    connected yet. The endpoint reads from the ``integrations`` table so
    that when OAuth flows ship (F-future) it just works."""
    integrations = use_case.execute(user_id=user.id)
    return [IntegrationResponse.from_domain(i) for i in integrations]
