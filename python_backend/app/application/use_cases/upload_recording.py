"""UploadRecordingUseCase (B6, Pro+).

Persists an audio blob to storage and registers the metadata row. Tier-gated
via ``IsRecordingsAvailableUseCase``: free-tier users get ``UpgradeRequiredError``."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from app.application.ports.audio_storage import AudioStorage
from app.application.ports.recordings_repository import RecordingsRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.user_preferences_repository import (
    UserPreferencesRepository,
)
from app.application.use_cases.check_tier_limits import (
    IsRecordingsAvailableUseCase,
)
from app.domain.entities.recording import Recording
from app.domain.exceptions import (
    NotFoundError,
    UpgradeRequiredError,
    ValidationError,
)


logger = logging.getLogger(__name__)


_VALID_FORMATS = {"pcm", "mp3", "opus", "webm", "wav", "ogg", "m4a"}


class UploadRecordingUseCase:
    """Upload an audio file for a session.

    Pre-conditions:
    - Session exists and is owned by ``user_id`` (multi-tenant)
    - User's plan unlocks recordings (Pro+)

    Post-conditions:
    - Object stored at ``recordings/{user_id}/{session_id}.{format}``
    - ``recordings`` row upserted (1:1 with session)
    - ``expires_at`` computed from user prefs (None = never auto-delete)"""

    def __init__(
        self,
        *,
        sessions_repo: SessionsRepository,
        recordings_repo: RecordingsRepository,
        storage: AudioStorage,
        prefs_repo: UserPreferencesRepository,
        is_available: IsRecordingsAvailableUseCase,
    ) -> None:
        self.sessions_repo = sessions_repo
        self.recordings_repo = recordings_repo
        self.storage = storage
        self.prefs_repo = prefs_repo
        self.is_available = is_available

    async def execute(
        self,
        *,
        session_id: str,
        user_id: str,
        data: bytes,
        audio_format: str,
        content_type: str,
    ) -> Recording:
        if not data:
            raise ValidationError("El archivo de audio está vacío")

        fmt = audio_format.lower().strip().lstrip(".")
        if fmt not in _VALID_FORMATS:
            raise ValidationError(
                f"Formato de audio no soportado: {audio_format}. "
                f"Usá uno de: {', '.join(sorted(_VALID_FORMATS))}"
            )

        # Multi-tenant ownership check.
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        # Tier gate.
        if not self.is_available.execute(user_id=user_id):
            raise UpgradeRequiredError(
                "Las grabaciones requieren plan Pro o superior",
                limit="max_recordings",
                current_tier="free",
                required_tier="pro",
            )

        # Build storage key. Namespaced by user_id for clean prefix-listing
        # and so a tenant deletion can sweep one prefix.
        key = f"recordings/{user_id}/{session_id}.{fmt}"

        meta = await self.storage.upload(
            key=key, data=data, content_type=content_type
        )
        size_bytes = int(meta.get("size_bytes", len(data)))

        # Compute expiration based on user prefs.
        expires_at: Optional[datetime] = None
        try:
            prefs = self.prefs_repo.get(user_id)
        except Exception as e:  # noqa: BLE001 — prefs lookup is best-effort
            logger.warning(
                f"[UploadRecording] prefs lookup failed for {user_id}: {e}"
            )
            prefs = None

        days = prefs.auto_delete_recordings_days if prefs else None
        if days is not None and days > 0:
            expires_at = (
                datetime.now(timezone.utc).replace(tzinfo=None)
                + timedelta(days=days)
            )

        recording = Recording(
            session_id=session_id,
            audio_path=key,
            audio_format=fmt,  # type: ignore[arg-type]
            audio_duration_seconds=session.duration_seconds or 0,
            audio_size_bytes=size_bytes,
            expires_at=expires_at,
            created_at=datetime.now(timezone.utc).replace(tzinfo=None),
        )
        return self.recordings_repo.upsert(recording)
