"""DeleteRecordingUseCase (B6).

Removes both the storage object and the metadata row. Best-effort on the
storage delete (a missing object is treated as already-deleted)."""
from __future__ import annotations

import logging

from app.application.ports.audio_storage import AudioStorage
from app.application.ports.recordings_repository import RecordingsRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.domain.exceptions import NotFoundError


logger = logging.getLogger(__name__)


class DeleteRecordingUseCase:
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

    async def execute(self, *, session_id: str, user_id: str) -> bool:
        # Multi-tenant ownership check.
        session = self.sessions_repo.get(session_id, user_id)
        if session is None:
            raise NotFoundError(f"sesión {session_id} no encontrada")

        recording = self.recordings_repo.get(session_id)
        if recording is None:
            return False

        try:
            await self.storage.delete(recording.audio_path)
        except Exception as e:  # noqa: BLE001 — proceed to DB delete anyway
            logger.warning(
                f"[DeleteRecording] storage delete failed for "
                f"{recording.audio_path}: {e}"
            )

        return self.recordings_repo.delete(session_id)
