"""Session materials REST endpoints.

All endpoints are nested under ``/api/sessions/{session_id}/materials`` and
authz-scoped: the use case validates that ``session_id`` belongs to the
authenticated user before reading/mutating its materials.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.application.use_cases.create_session_material import (
    CreateSessionMaterialUseCase,
)
from app.application.use_cases.delete_session_material import (
    DeleteSessionMaterialUseCase,
)
from app.application.use_cases.list_session_materials import (
    ListSessionMaterialsUseCase,
)
from app.domain.entities.user import User
from app.domain.exceptions import NotFoundError, ValidationError
from app.presentation.api.schemas import (
    CreateSessionMaterialRequest,
    DeleteResponse,
    SessionMaterialResponse,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_create_session_material_use_case,
    get_delete_session_material_use_case,
    get_list_session_materials_use_case,
)


router = APIRouter()


@router.get(
    "/api/sessions/{session_id}/materials",
    response_model=list[SessionMaterialResponse],
)
async def list_session_materials(
    session_id: str,
    user: User = Depends(get_current_user),
    use_case: ListSessionMaterialsUseCase = Depends(
        get_list_session_materials_use_case
    ),
) -> list[SessionMaterialResponse]:
    try:
        materials = use_case.execute(session_id=session_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return [SessionMaterialResponse.from_domain(m) for m in materials]


@router.post(
    "/api/sessions/{session_id}/materials",
    response_model=SessionMaterialResponse,
)
async def create_session_material(
    session_id: str,
    body: CreateSessionMaterialRequest,
    user: User = Depends(get_current_user),
    use_case: CreateSessionMaterialUseCase = Depends(
        get_create_session_material_use_case
    ),
) -> SessionMaterialResponse:
    try:
        material = use_case.execute(
            session_id=session_id,
            user_id=user.id,
            material_type=body.material_type,
            title=body.title,
            content=body.content,
            source_url=body.source_url,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return SessionMaterialResponse.from_domain(material)


@router.delete(
    "/api/sessions/{session_id}/materials/{material_id}",
    response_model=DeleteResponse,
)
async def delete_session_material(
    session_id: str,
    material_id: int,
    user: User = Depends(get_current_user),
    use_case: DeleteSessionMaterialUseCase = Depends(
        get_delete_session_material_use_case
    ),
) -> DeleteResponse:
    try:
        use_case.execute(
            session_id=session_id,
            material_id=material_id,
            user_id=user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return DeleteResponse(deleted=True)
