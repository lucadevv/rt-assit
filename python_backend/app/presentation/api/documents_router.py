"""Documents REST endpoints — thin layer that maps HTTP <-> use cases.

B0 migration: all endpoints derive ``user_id`` from the authenticated user
(``Depends(get_current_user)``) instead of the legacy ``USER_ID='default'``
constant. Multi-tenant invariant: rows are always scoped to ``user.id``."""
import logging
from typing import Optional

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile

from app.application.use_cases.delete_document import DeleteDocumentUseCase
from app.application.use_cases.get_document import GetDocumentUseCase
from app.application.use_cases.list_documents import ListDocumentsUseCase
from app.application.use_cases.update_document import UpdateDocumentUseCase
from app.application.use_cases.upload_document import UploadDocumentUseCase
from app.application.use_cases.upload_document_from_text import (
    UploadDocumentFromTextUseCase,
)
from app.application.use_cases.upload_document_from_url import (
    UploadDocumentFromURLUseCase,
)
from app.domain.entities.user import User
from app.domain.exceptions import ExtractionError, NotFoundError, ValidationError
from app.presentation.api.schemas import (
    DeleteResponse,
    DocumentDetail,
    DocumentSummary,
    UpdateDocumentRequest,
    UploadFileResponse,
    UploadTextRequest,
    UploadURLRequest,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_delete_document_use_case,
    get_get_document_use_case,
    get_list_documents_use_case,
    get_update_document_use_case,
    get_upload_document_from_text_use_case,
    get_upload_document_from_url_use_case,
    get_upload_document_use_case,
)


logger = logging.getLogger(__name__)


router = APIRouter()


def _check_docs_limit(user_id: str) -> None:
    """B5 — gate uploads on max_docs (free tier=5, others unlimited).

    Counts current docs and raises HTTP 402 if exceeded."""
    from app.application.use_cases.check_tier_limits import (
        CheckTierLimitsUseCase,
    )
    from app.domain.exceptions import UpgradeRequiredError
    from app.presentation.api.billing_router import upgrade_required_to_http
    from app.presentation.deps import (
        get_documents_repository,
        get_plans_repository,
        get_subscriptions_repository,
        get_usage_repository,
    )

    try:
        docs_repo = get_documents_repository()
        # Count user's docs by listing (cheap; SQLite is fast enough).
        current = len(docs_repo.list(user_id))
        check = CheckTierLimitsUseCase(
            subscriptions_repo=get_subscriptions_repository(),
            plans_repo=get_plans_repository(),
            usage_repo=get_usage_repository(),
        )
        check.execute(
            user_id=user_id,
            limit="max_docs",
            current_value=current,
            increment=1,
        )
    except UpgradeRequiredError as e:
        raise upgrade_required_to_http(e) from e
    except HTTPException:
        raise
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[Documents] tier gate skipped: {e}")


def _track_docs_count(user_id: str) -> None:
    """Best-effort post-upload counter increment."""
    try:
        from app.presentation.deps import build_increment_docs_count_use_case

        build_increment_docs_count_use_case().execute(user_id=user_id)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[Usage] docs_count increment failed: {e}")


@router.post("/api/documents", response_model=UploadFileResponse)
async def upload_file(
    file: UploadFile = File(...),
    doc_type: str = Form(...),
    scenario: Optional[str] = Form(None),
    user: User = Depends(get_current_user),
    use_case: UploadDocumentUseCase = Depends(get_upload_document_use_case),
) -> UploadFileResponse:
    _check_docs_limit(user.id)
    data = await file.read()
    try:
        doc = use_case.execute(
            user_id=user.id,
            filename=file.filename or "sin_nombre",
            data=data,
            doc_type=doc_type,
            scenario=scenario,
            content_type=file.content_type,
        )
    except ValidationError as e:
        # 413 for the size-specific validation, 400 for everything else.
        msg = str(e)
        if "demasiado grande" in msg:
            raise HTTPException(status_code=413, detail=msg) from e
        raise HTTPException(status_code=400, detail=msg) from e
    except ExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    _track_docs_count(user.id)
    return UploadFileResponse(
        id=doc.id,
        title=doc.title,
        doc_type=doc.doc_type,
        scenario=doc.scenario,
        size_chars=len(doc.content),
    )


@router.post("/api/documents/url", response_model=UploadFileResponse)
async def upload_url(
    body: UploadURLRequest,
    user: User = Depends(get_current_user),
    use_case: UploadDocumentFromURLUseCase = Depends(
        get_upload_document_from_url_use_case
    ),
) -> UploadFileResponse:
    _check_docs_limit(user.id)
    try:
        doc = await use_case.execute(
            user_id=user.id,
            url=body.url,
            doc_type=body.doc_type,
            scenario=body.scenario,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    _track_docs_count(user.id)
    return UploadFileResponse(
        id=doc.id,
        title=doc.title,
        doc_type=doc.doc_type,
        scenario=doc.scenario,
        size_chars=len(doc.content),
    )


@router.post("/api/documents/text", response_model=UploadFileResponse)
async def upload_text(
    body: UploadTextRequest,
    user: User = Depends(get_current_user),
    use_case: UploadDocumentFromTextUseCase = Depends(
        get_upload_document_from_text_use_case
    ),
) -> UploadFileResponse:
    _check_docs_limit(user.id)
    try:
        doc = use_case.execute(
            user_id=user.id,
            title=body.title,
            text=body.text,
            doc_type=body.doc_type,
            scenario=body.scenario,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except ExtractionError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e

    _track_docs_count(user.id)
    return UploadFileResponse(
        id=doc.id,
        title=doc.title,
        doc_type=doc.doc_type,
        scenario=doc.scenario,
        size_chars=len(doc.content),
    )


@router.get("/api/documents", response_model=list[DocumentSummary])
async def list_documents(
    scenario: Optional[str] = None,
    doc_type: Optional[str] = None,
    user: User = Depends(get_current_user),
    use_case: ListDocumentsUseCase = Depends(get_list_documents_use_case),
) -> list[DocumentSummary]:
    docs = use_case.execute(user_id=user.id, scenario=scenario, doc_type=doc_type)
    return [
        DocumentSummary(
            id=d.id,
            doc_type=d.doc_type,
            scenario=d.scenario,
            title=d.title,
            source=d.source,
            uploaded_at=d.uploaded_at,
            size_chars=len(d.content),
            metadata=d.metadata,
        )
        for d in docs
    ]


@router.get("/api/documents/{doc_id}", response_model=DocumentDetail)
async def get_document(
    doc_id: int,
    user: User = Depends(get_current_user),
    use_case: GetDocumentUseCase = Depends(get_get_document_use_case),
) -> DocumentDetail:
    try:
        doc = use_case.execute(user_id=user.id, doc_id=doc_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return DocumentDetail(
        id=doc.id,
        doc_type=doc.doc_type,
        scenario=doc.scenario,
        title=doc.title,
        content=doc.content,
        source=doc.source,
        uploaded_at=doc.uploaded_at,
        metadata=doc.metadata,
    )


@router.patch("/api/documents/{doc_id}", response_model=DocumentDetail)
async def update_document(
    doc_id: int,
    request: UpdateDocumentRequest,
    user: User = Depends(get_current_user),
    use_case: UpdateDocumentUseCase = Depends(get_update_document_use_case),
) -> DocumentDetail:
    try:
        doc = use_case.execute(
            user_id=user.id,
            doc_id=doc_id,
            title=request.title,
            content=request.content,
            is_primary=request.is_primary,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    return DocumentDetail(
        id=doc.id,
        doc_type=doc.doc_type,
        scenario=doc.scenario,
        title=doc.title,
        content=doc.content,
        source=doc.source,
        uploaded_at=doc.uploaded_at,
        metadata=doc.metadata,
    )


@router.delete("/api/documents/{doc_id}", response_model=DeleteResponse)
async def delete_document(
    doc_id: int,
    user: User = Depends(get_current_user),
    use_case: DeleteDocumentUseCase = Depends(get_delete_document_use_case),
) -> DeleteResponse:
    try:
        use_case.execute(user_id=user.id, doc_id=doc_id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return DeleteResponse(deleted=True)
