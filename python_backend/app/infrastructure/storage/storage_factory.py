"""Audio storage factory (B6).

Reads STORAGE_MODE and assembles the correct adapter:
- ``local`` (default): ``LocalAudioStorage`` writing to ``LOCAL_STORAGE_DIR``
- ``s3``:               ``S3AudioStorage`` with ``S3_*`` credentials

If STORAGE_MODE=s3 is requested but boto3 isn't installed or credentials are
missing, we fall back to local with a warning (so dev containers stay bootable).
"""
from __future__ import annotations

import logging
import os

from app.application.ports.audio_storage import AudioStorage
from app.infrastructure.storage.local_audio_storage import LocalAudioStorage


logger = logging.getLogger(__name__)


def is_s3_mode() -> bool:
    return os.getenv("STORAGE_MODE", "local").lower() == "s3"


def create_audio_storage() -> AudioStorage:
    mode = os.getenv("STORAGE_MODE", "local").lower()
    if mode == "s3":
        bucket = os.getenv("S3_BUCKET", "").strip()
        region = os.getenv("S3_REGION", "us-east-1").strip() or "us-east-1"
        endpoint_url = os.getenv("S3_ENDPOINT_URL", "").strip() or None
        access_key = os.getenv("S3_ACCESS_KEY", "").strip()
        secret_key = os.getenv("S3_SECRET_KEY", "").strip()

        if not bucket:
            logger.warning(
                "[StorageFactory] STORAGE_MODE=s3 but S3_BUCKET is empty — "
                "falling back to local storage."
            )
        else:
            try:
                from app.infrastructure.storage.s3_audio_storage import (
                    S3AudioStorage,
                )

                return S3AudioStorage(
                    bucket=bucket,
                    region=region,
                    endpoint_url=endpoint_url,
                    access_key=access_key,
                    secret_key=secret_key,
                )
            except RuntimeError as e:  # boto3 missing
                logger.warning(
                    f"[StorageFactory] S3 mode requested but unusable: {e} — "
                    "falling back to local."
                )

    return LocalAudioStorage(
        base_dir=os.getenv("LOCAL_STORAGE_DIR", "/app/data/recordings"),
        signing_secret=os.getenv("LOCAL_STORAGE_SECRET", "dev-storage-secret"),
        public_base_url=os.getenv(
            "LOCAL_STORAGE_PUBLIC_URL", "http://localhost:8767"
        ),
    )
