"""Recording domain entity (B6 — Pro+).

A 1:1 sidecar to ``Session``: when a user with the recording feature
unlocked ends a session with ``is_recording=True``, the audio chunks are
materialised into storage and a ``Recording`` row links the storage key to
the session for later playback / signed URLs.

Pure data — no framework or infrastructure dependencies."""
from dataclasses import dataclass
from datetime import datetime
from typing import Literal, Optional


AudioFormat = Literal["pcm", "mp3", "opus", "webm", "wav", "ogg", "m4a"]


@dataclass
class Recording:
    """An audio recording attached to a session.

    ``session_id`` is the PK (1 recording max per session — uploads upsert).
    ``audio_path`` is the opaque storage key (S3 object key in prod, local
    filesystem path in dev). ``expires_at`` is computed at upload time from
    the user's ``auto_delete_recordings_days`` preference; ``None`` means
    "never auto-delete"."""

    session_id: str
    audio_path: str
    audio_format: AudioFormat
    audio_duration_seconds: int
    audio_size_bytes: int
    expires_at: Optional[datetime]
    created_at: datetime
