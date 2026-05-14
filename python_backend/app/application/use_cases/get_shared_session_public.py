"""GetSharedSessionPublicUseCase (B7 — Premium share links).

Resolves a public share-link to the session payload it grants access to.
This is the heart of the unauthenticated public endpoint:

- No auth required (the link id IS the credential — public-by-design).
- Validates the link exists, is not revoked, has not expired.
- Increments ``view_count`` atomically before serving the payload.
- Builds the response based on the link's ``permissions``:
    transcript_only -> session metadata + transcripts + hints + speakers
    with_audio      -> + signed audio URL (1h)
    edit            -> same as with_audio (edit semantics owned by frontend)

The link itself carries the owner's ``user_id``, so the use case can fetch
the session via the regular owner-scoped repo without the recipient needing
auth credentials."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Any

from app.application.ports.audio_storage import AudioStorage
from app.application.ports.hints_repository import HintsRepository
from app.application.ports.recordings_repository import RecordingsRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.share_links_repository import ShareLinksRepository
from app.application.ports.speakers_repository import SpeakersRepository
from app.application.ports.transcripts_repository import TranscriptsRepository
from app.domain.entities.hint import Hint
from app.domain.entities.persisted_transcript import PersistedTranscript
from app.domain.entities.session import Session
from app.domain.entities.share_link import ShareLink
from app.domain.entities.speaker import Speaker
from app.domain.exceptions import GoneError, NotFoundError


logger = logging.getLogger(__name__)


class GetSharedSessionPublicUseCase:
    """Resolve a public share link → session payload (no auth)."""

    def __init__(
        self,
        *,
        share_repo: ShareLinksRepository,
        sessions_repo: SessionsRepository,
        transcripts_repo: TranscriptsRepository,
        hints_repo: HintsRepository,
        speakers_repo: SpeakersRepository,
        recordings_repo: RecordingsRepository,
        storage: AudioStorage,
    ) -> None:
        self.share_repo = share_repo
        self.sessions_repo = sessions_repo
        self.transcripts_repo = transcripts_repo
        self.hints_repo = hints_repo
        self.speakers_repo = speakers_repo
        self.recordings_repo = recordings_repo
        self.storage = storage

    async def execute(self, link_id: str) -> dict[str, Any]:
        link = self.share_repo.get(link_id)
        if link is None:
            raise NotFoundError("Link no encontrado")

        # Order matters: revoked beats expired (admin action takes precedence).
        if link.revoked_at is not None:
            raise GoneError("Link revocado")
        if link.expires_at is not None and link.expires_at <= datetime.utcnow():
            raise GoneError("Link expirado")

        # Atomic view count increment before fetching the payload — even if
        # the session lookup fails for some reason, the access attempt is
        # recorded. Best-effort: never blocks if increment fails.
        try:
            self.share_repo.increment_view_count(link_id)
        except Exception as e:  # noqa: BLE001
            logger.warning(
                f"[GetSharedSessionPublic] view_count increment failed: {e}"
            )

        # Fetch session via owner's user_id (link carries it). The session
        # may have been soft-deleted after the link was created — treat that
        # as "session no disponible" (404) so the recipient gets a clear
        # error rather than a half-rendered page.
        session = self.sessions_repo.get(link.session_id, link.user_id)
        if session is None:
            raise NotFoundError("Sesión no disponible")

        transcripts: list[PersistedTranscript] = (
            self.transcripts_repo.get_for_session(
                session_id=link.session_id, only_final=False
            )
        )
        hints: list[Hint] = self.hints_repo.get_for_session(link.session_id)
        speakers: list[Speaker] = self.speakers_repo.list_for_session(
            link.session_id
        )

        result: dict[str, Any] = {
            "link": link,
            "session": session,
            "transcripts": transcripts,
            "hints": hints,
            "speakers": speakers,
            "permissions": link.permissions,
        }

        # If the link grants audio access, surface a signed playback URL.
        # Edit permission is treated like with_audio for B7 — collaborator
        # write semantics are intentionally out-of-scope for this phase.
        if link.permissions in ("with_audio", "edit"):
            try:
                recording = self.recordings_repo.get(link.session_id)
            except Exception as e:  # noqa: BLE001
                logger.warning(
                    f"[GetSharedSessionPublic] recording lookup failed: {e}"
                )
                recording = None
            if recording is not None:
                try:
                    result["audio_url"] = await self.storage.get_signed_url(
                        recording.audio_path, expires_seconds=3600
                    )
                except Exception as e:  # noqa: BLE001
                    logger.warning(
                        f"[GetSharedSessionPublic] signed URL failed: {e}"
                    )

        return result
