"""Recordings REST endpoints (B6 — Pro+ feature).

Routes:
  POST   /api/sessions/{session_id}/recording/upload   — multipart audio upload
  GET    /api/sessions/{session_id}/recording          — fetch metadata + signed URL
  DELETE /api/sessions/{session_id}/recording          — remove recording (file + DB)
  GET    /api/recordings                               — list user's recordings
  GET    /api/internal/recordings/{key:path}           — dev-mode local file server (HMAC)

All routes (except the dev internal one which validates HMAC token) require
auth via ``get_current_user``. Tier gating: free tier users get HTTP 402 on
upload attempts (recordings unlock at Pro)."""
from __future__ import annotations

import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse

from app.application.use_cases.delete_recording import DeleteRecordingUseCase
from app.application.use_cases.get_recording_url import GetRecordingUrlUseCase
from app.application.use_cases.list_recordings import ListRecordingsUseCase
from app.application.use_cases.upload_recording import UploadRecordingUseCase
from app.domain.entities.user import User
from app.domain.exceptions import (
    NotFoundError,
    UpgradeRequiredError,
    ValidationError,
)
from app.infrastructure.storage.local_audio_storage import verify_local_token
from app.infrastructure.storage.storage_factory import is_s3_mode
from app.presentation.api.billing_router import upgrade_required_to_http
from app.presentation.api.schemas import (
    DeleteResponse,
    RecordingListItemResponse,
    RecordingResponse,
    RecordingUrlResponse,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_delete_recording_use_case,
    get_get_recording_url_use_case,
    get_list_recordings_use_case,
    get_upload_recording_use_case,
)


logger = logging.getLogger(__name__)


router = APIRouter()


# 500 MB upload cap. Configurable via env so prod can tune it.
MAX_UPLOAD_BYTES = int(os.getenv("MAX_RECORDING_BYTES", str(500 * 1024 * 1024)))


def _detect_format(filename: Optional[str], content_type: Optional[str]) -> str:
    """Best-effort format detection.

    Falls back to ``webm`` because that's what browser MediaRecorder emits
    when no codec preference is set. The use case validates the result
    against a whitelist."""
    if filename and "." in filename:
        ext = filename.rsplit(".", 1)[-1].lower().strip()
        if ext:
            return ext
    if content_type:
        # ``audio/webm`` -> ``webm``; ``audio/mpeg`` -> ``mp3``; etc.
        ct = content_type.split(";")[0].strip().lower()
        mapping = {
            "audio/webm": "webm",
            "audio/wav": "wav",
            "audio/x-wav": "wav",
            "audio/mpeg": "mp3",
            "audio/mp3": "mp3",
            "audio/ogg": "ogg",
            "audio/opus": "opus",
            "audio/m4a": "m4a",
            "audio/x-m4a": "m4a",
            "audio/mp4": "m4a",
        }
        if ct in mapping:
            return mapping[ct]
    return "webm"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/api/sessions/{session_id}/recording/upload",
    response_model=RecordingResponse,
)
async def upload_recording(
    session_id: str,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    use_case: UploadRecordingUseCase = Depends(get_upload_recording_use_case),
) -> RecordingResponse:
    """Upload an audio file for a session. Pro+ only.

    Errors:
    - 402 Payment Required → user is on Free tier
    - 404 Not Found       → session does not belong to the user
    - 413 Payload Too Large → file exceeds MAX_RECORDING_BYTES
    - 400 Bad Request     → empty file / unsupported format
    """
    # Cheap pre-check via Content-Length-derived ``file.size`` if present.
    if file.size is not None and file.size > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo demasiado grande (máx {MAX_UPLOAD_BYTES} bytes)",
        )

    data = await file.read()
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Archivo demasiado grande (máx {MAX_UPLOAD_BYTES} bytes)",
        )

    fmt = _detect_format(file.filename, file.content_type)
    content_type = file.content_type or "application/octet-stream"

    try:
        recording = await use_case.execute(
            session_id=session_id,
            user_id=user.id,
            data=data,
            audio_format=fmt,
            content_type=content_type,
        )
    except UpgradeRequiredError as e:
        raise upgrade_required_to_http(e) from e
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    return RecordingResponse.from_domain(recording)


@router.get(
    "/api/sessions/{session_id}/recording",
    response_model=RecordingUrlResponse,
)
async def get_recording_url(
    session_id: str,
    user: User = Depends(get_current_user),
    use_case: GetRecordingUrlUseCase = Depends(get_get_recording_url_use_case),
) -> RecordingUrlResponse:
    """Returns a signed playback URL valid for ~1 hour."""
    try:
        url = await use_case.execute(
            session_id=session_id,
            user_id=user.id,
            expires_seconds=3600,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return RecordingUrlResponse(url=url, expires_seconds=3600)


@router.delete(
    "/api/sessions/{session_id}/recording",
    response_model=DeleteResponse,
)
async def delete_recording(
    session_id: str,
    user: User = Depends(get_current_user),
    use_case: DeleteRecordingUseCase = Depends(get_delete_recording_use_case),
) -> DeleteResponse:
    try:
        deleted = await use_case.execute(
            session_id=session_id, user_id=user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return DeleteResponse(deleted=deleted)


@router.get(
    "/api/recordings", response_model=list[RecordingListItemResponse]
)
async def list_recordings(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    use_case: ListRecordingsUseCase = Depends(get_list_recordings_use_case),
) -> list[RecordingListItemResponse]:
    """Lists user's recordings with their session metadata.

    Note: this endpoint is NOT tier-gated — Free users simply have an empty
    list because they can't upload recordings."""
    pairs = use_case.execute(user_id=user.id, limit=limit, offset=offset)
    return [
        RecordingListItemResponse.from_domain(rec, sess)
        for rec, sess in pairs
    ]


# ---------------------------------------------------------------------------
# Dev-only internal endpoint: serve local recordings via HMAC token
# ---------------------------------------------------------------------------


@router.get("/api/internal/recordings/{key:path}")
async def serve_local_recording(key: str, token: str = Query(...)):
    """HMAC-validated file server. Only useful when STORAGE_MODE=local.

    The signed URL produced by ``LocalAudioStorage.get_signed_url`` points
    here. We validate token signature + expiry + key match, then stream the
    file via ``FileResponse``. In prod (STORAGE_MODE=s3) this endpoint is
    inert — S3 generates its own presigned URLs and clients fetch directly
    from the bucket."""
    if is_s3_mode():
        # Defensive: if STORAGE_MODE=s3, the bucket presigned URL is the
        # source of truth; refuse to serve local files even if they exist.
        raise HTTPException(status_code=404, detail="not found")

    secret = os.getenv("LOCAL_STORAGE_SECRET", "dev-storage-secret")
    valid, reason = verify_local_token(
        token=token, expected_key=key, secret=secret
    )
    if not valid:
        # 403 (signature/expiry) is more accurate than 404 here — the file
        # may exist but the link isn't authorized.
        raise HTTPException(status_code=403, detail=f"acceso denegado: {reason}")

    # Resolve under base_dir + traversal-safe.
    base_dir = os.getenv("LOCAL_STORAGE_DIR", "/app/data/recordings")
    from pathlib import Path

    base = Path(base_dir).resolve()
    if os.path.isabs(key) or ".." in Path(key).parts:
        raise HTTPException(status_code=400, detail="key inválida")
    target = (base / key).resolve()
    try:
        target.relative_to(base)
    except ValueError as e:
        raise HTTPException(status_code=400, detail="key fuera del base_dir") from e
    if not target.is_file():
        raise HTTPException(status_code=404, detail="archivo no encontrado")

    return FileResponse(path=str(target), media_type="application/octet-stream")
