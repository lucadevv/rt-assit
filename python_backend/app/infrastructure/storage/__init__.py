"""Audio storage adapters (B6).

- ``LocalAudioStorage`` for STORAGE_MODE=local (dev): files on disk + HMAC URLs
- ``S3AudioStorage`` for STORAGE_MODE=s3 (prod / MinIO): boto3 + presigned URLs
- ``create_audio_storage()`` is the factory."""

from app.infrastructure.storage.storage_factory import create_audio_storage


__all__ = ["create_audio_storage"]
