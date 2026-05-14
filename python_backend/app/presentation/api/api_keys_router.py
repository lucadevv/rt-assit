"""BYOK API-key REST endpoints (B8).

Routes:
  GET    /api/api-keys      — list user's BYOK keys (no ciphertext exposed)
  POST   /api/api-keys      — add a key (encrypts via APIKeyEncryptor)
  DELETE /api/api-keys/:id  — delete a key
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.application.use_cases.manage_api_keys import (
    AddAPIKeyUseCase,
    DeleteAPIKeyUseCase,
    ListAPIKeysUseCase,
)
from app.domain.entities.user import User
from app.domain.exceptions import NotFoundError, ValidationError
from app.presentation.api.schemas import (
    AddAPIKeyRequest,
    APIKeyResponse,
    DeleteResponse,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_add_api_key_use_case,
    get_delete_api_key_use_case,
    get_list_api_keys_use_case,
)


router = APIRouter()


@router.get("/api/api-keys", response_model=list[APIKeyResponse])
async def list_api_keys(
    user: User = Depends(get_current_user),
    use_case: ListAPIKeysUseCase = Depends(get_list_api_keys_use_case),
) -> list[APIKeyResponse]:
    keys = use_case.execute(user_id=user.id)
    return [APIKeyResponse.from_domain(k) for k in keys]


@router.post("/api/api-keys", response_model=APIKeyResponse, status_code=201)
async def add_api_key(
    body: AddAPIKeyRequest,
    user: User = Depends(get_current_user),
    use_case: AddAPIKeyUseCase = Depends(get_add_api_key_use_case),
) -> APIKeyResponse:
    try:
        key = use_case.execute(
            user_id=user.id, provider=body.provider, key=body.key
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return APIKeyResponse.from_domain(key)


@router.delete("/api/api-keys/{key_id}", response_model=DeleteResponse)
async def delete_api_key(
    key_id: int,
    user: User = Depends(get_current_user),
    use_case: DeleteAPIKeyUseCase = Depends(get_delete_api_key_use_case),
) -> DeleteResponse:
    try:
        use_case.execute(api_key_id=key_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return DeleteResponse(deleted=True)
