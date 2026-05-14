"""Auto-register a speaker on first encounter of a deepgram cluster id."""
from app.application.ports.speakers_repository import SpeakersRepository
from app.domain.entities.speaker import Speaker


class RegisterSpeakerUseCase:
    def __init__(self, repo: SpeakersRepository) -> None:
        self.repo = repo

    def execute(
        self,
        *,
        session_id: str,
        deepgram_speaker_id: int,
        is_user: bool = False,
    ) -> Speaker:
        return self.repo.get_or_create(
            session_id=session_id,
            deepgram_speaker_id=deepgram_speaker_id,
            is_user=is_user,
        )
