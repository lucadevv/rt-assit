"""S3AudioStorage — prod / MinIO adapter for ``AudioStorage``.

Wraps boto3 (sync SDK) calls in ``asyncio.to_thread`` so the API stays async.
boto3 is imported lazily so dev containers without it (or with STORAGE_MODE=local)
boot cleanly.

Compatible with both AWS S3 and MinIO; supply ``endpoint_url`` to point at MinIO.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from app.application.ports.audio_storage import AudioStorage


logger = logging.getLogger(__name__)


class S3AudioStorage(AudioStorage):
    def __init__(
        self,
        *,
        bucket: str,
        region: str,
        endpoint_url: Optional[str],
        access_key: str,
        secret_key: str,
    ) -> None:
        try:
            import boto3  # type: ignore[import-untyped]
            from botocore.client import Config  # type: ignore[import-untyped]
        except ImportError as e:  # pragma: no cover
            raise RuntimeError(
                "boto3 no está instalado; añadí boto3>=1.35 a las "
                "dependencias o cambiá STORAGE_MODE=local"
            ) from e

        self.bucket = bucket
        self.region = region
        self.endpoint_url = endpoint_url

        # Force signature_version=s3v4 so MinIO and modern AWS regions
        # accept the presigned URLs.
        self._client = boto3.client(
            "s3",
            region_name=region,
            endpoint_url=endpoint_url or None,
            aws_access_key_id=access_key or None,
            aws_secret_access_key=secret_key or None,
            config=Config(signature_version="s3v4"),
        )
        logger.info(
            f"[S3AudioStorage] bucket={bucket} region={region} "
            f"endpoint_url={endpoint_url or '<aws-default>'}"
        )

    async def upload(
        self, *, key: str, data: bytes, content_type: str
    ) -> dict[str, Any]:
        def _put() -> int:
            self._client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=content_type,
            )
            return len(data)

        size = await asyncio.to_thread(_put)
        return {"size_bytes": size, "content_type": content_type, "key": key}

    async def get_signed_url(
        self, key: str, *, expires_seconds: int = 3600
    ) -> str:
        def _sign() -> str:
            return self._client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket, "Key": key},
                ExpiresIn=int(expires_seconds),
            )

        return await asyncio.to_thread(_sign)

    async def delete(self, key: str) -> bool:
        def _del() -> bool:
            # head_object first so we can return whether it existed; then
            # delete (always succeeds for missing keys, but we want the
            # existed-bool for the API contract).
            try:
                self._client.head_object(Bucket=self.bucket, Key=key)
                existed = True
            except Exception:  # noqa: BLE001 — 404, NoSuchKey, etc.
                existed = False
            self._client.delete_object(Bucket=self.bucket, Key=key)
            return existed

        return await asyncio.to_thread(_del)

    async def exists(self, key: str) -> bool:
        def _head() -> bool:
            try:
                self._client.head_object(Bucket=self.bucket, Key=key)
                return True
            except Exception:  # noqa: BLE001
                return False

        return await asyncio.to_thread(_head)
