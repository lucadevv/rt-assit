"""GetRecordingUrlUseCase (B6).

Returns a time-limited signed URL for playback. Multi-tenant: ownership is
enforced via the session row (recording PK = session_id, session has user_id)."""
from __future__ import annotations

from app.application.ports.audio_storage import AudioStorage
from app.application.ports.recordings_repository import RecordingsRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.exceptions import NotFoundError


class GetRecordingUrlUseCase:
    def __init__(
        self,
        *,
        sessions_repo: SessionsRepository,
        recordings_repo: RecordingsRepository,
        storage: AudioStorage,
    ) -> None:
        self.sessions_repo = sessions_repo
        self.recordings_repo = recordings_repo
        self.storage = storage

    async def execute(
        self,
        *,
        session_id: str,
        user_id: str,
        expires_seconds: int = 3600,
    ) -> str:
        # Verify ownership BEFORE looking up the recording — leaking
        # "recording exists for somebody else's session" would be a tenant
        # disclosure bug.
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        recording = self.recordings_repo.get(session_id)
        if recording is None:
            raise NotFoundError("No hay grabación para esta sesión")

        return await self.storage.get_signed_url(
            recording.audio_path, expires_seconds=expires_seconds
        )
