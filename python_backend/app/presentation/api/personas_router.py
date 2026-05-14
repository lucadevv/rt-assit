"""Personas REST endpoints.

Every endpoint is authz-scoped via ``Depends(get_current_user)`` — the
``user.id`` is the only multi-tenant filter we use. The use cases enforce
the same scope at the application layer.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.application.use_cases.create_persona import CreatePersonaUseCase
from app.application.use_cases.delete_persona import DeletePersonaUseCase
from app.application.use_cases.get_persona import GetPersonaUseCase
from app.application.use_cases.link_persona_document import (
    LinkPersonaDocumentUseCase,
)
from app.application.use_cases.list_personas import ListPersonasUseCase
from app.application.use_cases.set_default_persona import (
    SetDefaultPersonaUseCase,
)
from app.application.use_cases.unlink_persona_document import (
    UnlinkPersonaDocumentUseCase,
)
from app.application.use_cases.update_persona import UpdatePersonaUseCase
from app.domain.entities.user import User
from app.domain.exceptions import NotFoundError, ValidationError
from app.presentation.api.schemas import (
    CreatePersonaRequest,
    DeleteResponse,
    LinkDocumentRequest,
    PersonaResponse,
    UpdatePersonaRequest,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_create_persona_use_case,
    get_delete_persona_use_case,
    get_get_persona_use_case,
    get_link_persona_document_use_case,
    get_list_personas_use_case,
    get_set_default_persona_use_case,
    get_unlink_persona_document_use_case,
    get_update_persona_use_case,
)


router = APIRouter()


@router.get("/api/personas", response_model=list[PersonaResponse])
async def list_personas(
    user: User = Depends(get_current_user),
    use_case: ListPersonasUseCase = Depends(get_list_personas_use_case),
) -> list[PersonaResponse]:
    personas = use_case.execute(user_id=user.id)
    return [PersonaResponse.from_domain(p) for p in personas]


@router.post("/api/personas", response_model=PersonaResponse)
async def create_persona(
    body: CreatePersonaRequest,
    user: User = Depends(get_current_user),
    use_case: CreatePersonaUseCase = Depends(get_create_persona_use_case),
) -> PersonaResponse:
    try:
        persona = use_case.execute(
            user_id=user.id,
            name=body.name,
            description=body.description,
            scenario_id=body.scenario_id,
            icon=body.icon,
            tone=body.tone,
            custom_instructions=body.custom_instructions,
            is_default=body.is_default,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return PersonaResponse.from_domain(persona)


@router.get("/api/personas/{persona_id}", response_model=PersonaResponse)
async def get_persona(
    persona_id: int,
    user: User = Depends(get_current_user),
    use_case: GetPersonaUseCase = Depends(get_get_persona_use_case),
) -> PersonaResponse:
    try:
        persona = use_case.execute(persona_id=persona_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return PersonaResponse.from_domain(persona)


@router.patch("/api/personas/{persona_id}", response_model=PersonaResponse)
async def update_persona(
    persona_id: int,
    body: UpdatePersonaRequest,
    user: User = Depends(get_current_user),
    use_case: UpdatePersonaUseCase = Depends(get_update_persona_use_case),
) -> PersonaResponse:
    try:
        persona = use_case.execute(
            persona_id=persona_id,
            user_id=user.id,
            name=body.name,
            description=body.description,
            scenario_id=body.scenario_id,
            icon=body.icon,
            tone=body.tone,
            custom_instructions=body.custom_instructions,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return PersonaResponse.from_domain(persona)


@router.delete("/api/personas/{persona_id}", response_model=DeleteResponse)
async def delete_persona(
    persona_id: int,
    user: User = Depends(get_current_user),
    use_case: DeletePersonaUseCase = Depends(get_delete_persona_use_case),
) -> DeleteResponse:
    try:
        use_case.execute(persona_id=persona_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return DeleteResponse(deleted=True)


@router.post(
    "/api/personas/{persona_id}/default", response_model=PersonaResponse
)
async def set_default_persona(
    persona_id: int,
    user: User = Depends(get_current_user),
    use_case: SetDefaultPersonaUseCase = Depends(
        get_set_default_persona_use_case
    ),
) -> PersonaResponse:
    try:
        persona = use_case.execute(persona_id=persona_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return PersonaResponse.from_domain(persona)


@router.post(
    "/api/personas/{persona_id}/documents", response_model=DeleteResponse
)
async def link_persona_document(
    persona_id: int,
    body: LinkDocumentRequest,
    user: User = Depends(get_current_user),
    use_case: LinkPersonaDocumentUseCase = Depends(
        get_link_persona_document_use_case
    ),
) -> DeleteResponse:
    try:
        use_case.execute(
            persona_id=persona_id,
            document_id=body.document_id,
            is_identity=body.is_identity,
            user_id=user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    # ``deleted`` is a misnomer here but reusing DeleteResponse keeps the
    # contract consistent with other "ack" endpoints — the API returns
    # ``{"deleted": true}`` to mean "operation succeeded".
    return DeleteResponse(deleted=True)


@router.delete(
    "/api/personas/{persona_id}/documents/{document_id}",
    response_model=DeleteResponse,
)
async def unlink_persona_document(
    persona_id: int,
    document_id: int,
    user: User = Depends(get_current_user),
    use_case: UnlinkPersonaDocumentUseCase = Depends(
        get_unlink_persona_document_use_case
    ),
) -> DeleteResponse:
    try:
        use_case.execute(
            persona_id=persona_id,
            document_id=document_id,
            user_id=user.id,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return DeleteResponse(deleted=True)
