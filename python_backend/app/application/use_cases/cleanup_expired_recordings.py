"""CleanupExpiredRecordingsUseCase (B6).

Cron job — daily 03:00 UTC. Finds recordings whose ``expires_at <= now``
(per the user's ``auto_delete_recordings_days`` preference at upload time)
and deletes both the storage object and the metadata row.

Errors on individual recordings are logged and skipped — the loop continues
so one bad object doesn't poison the whole run."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from app.application.ports.audio_storage import AudioStorage
from app.application.ports.recordings_repository import RecordingsRepository


logger = logging.getLogger(__name__)


class CleanupExpiredRecordingsUseCase:
    def __init__(
        self,
        *,
        recordings_repo: RecordingsRepository,
        storage: AudioStorage,
    ) -> None:
        self.recordings_repo = recordings_repo
        self.storage = storage

    async def execute(self) -> int:
        """Returns the number of recordings successfully deleted."""
        now = datetime.now(timezone.utc).replace(tzinfo=None)
        expired = self.recordings_repo.list_expired(now)
        deleted = 0
        for rec in expired:
            try:
                await self.storage.delete(rec.audio_path)
                if self.recordings_repo.delete(rec.session_id):
                    deleted += 1
            except Exception as e:  # noqa: BLE001
                logger.error(
                    f"[Cleanup] Failed to delete recording for session "
                    f"{rec.session_id}: {e}"
                )
        logger.info(f"[Cleanup] Deleted {deleted} expired recordings")
        return deleted
