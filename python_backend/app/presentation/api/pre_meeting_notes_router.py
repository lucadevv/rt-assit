"""Pre-Interview Wizard REST endpoints.

Three endpoints:
  POST /api/pre-meeting-notes/generate   (preview-only — no persistence)
  POST /api/pre-meeting-notes            (persist after preview)
  GET  /api/sessions/{id}/pre-meeting-note  (read for the live UI)

Authz: every endpoint pulls ``user`` via ``get_current_user`` and the use
case validates session ownership (when applicable) before reading or
writing. The generate endpoint trusts the user_id for the persona-doc
context lookup but does NOT touch sessions.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException

from app.application.use_cases.create_pre_meeting_note import (
    CreatePreMeetingNoteUseCase,
)
from app.application.use_cases.generate_pre_meeting_note import (
    GeneratePreMeetingNoteUseCase,
)
from app.application.use_cases.get_pre_meeting_note import (
    GetPreMeetingNoteUseCase,
)
from app.domain.entities.user import User
from app.domain.exceptions import NotFoundError
from app.presentation.api.schemas import (
    CreatePreMeetingRequest,
    GeneratePreMeetingRequest,
    GeneratePreMeetingResponse,
    PreMeetingNoteResponse,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    get_create_pre_meeting_note_use_case,
    get_generate_pre_meeting_note_use_case,
    get_get_pre_meeting_note_use_case,
)


router = APIRouter()


@router.post(
    "/api/pre-meeting-notes/generate",
    response_model=GeneratePreMeetingResponse,
)
async def generate_pre_meeting_note(
    body: GeneratePreMeetingRequest,
    user: User = Depends(get_current_user),
    use_case: GeneratePreMeetingNoteUseCase = Depends(
        get_generate_pre_meeting_note_use_case
    ),
) -> GeneratePreMeetingResponse:
    try:
        questions, checklist = await use_case.execute(
            user_id=user.id,
            scenario_id=body.scenario_id,
            persona_id=body.persona_id,
            role_target=body.role_target,
            company_context=body.company_context,
            job_description=body.job_description,
            raw_user_input=body.raw_user_input,
        )
    except Exception as e:  # noqa: BLE001 — surface generation failures
        raise HTTPException(
            status_code=502,
            detail=f"No pudimos generar. Probá de nuevo en un momento. ({e!s})",
        ) from e
    return GeneratePreMeetingResponse(
        probing_questions=list(questions),
        prep_checklist=list(checklist),
    )


@router.post(
    "/api/pre-meeting-notes",
    response_model=PreMeetingNoteResponse,
)
async def create_pre_meeting_note(
    body: CreatePreMeetingRequest,
    user: User = Depends(get_current_user),
    use_case: CreatePreMeetingNoteUseCase = Depends(
        get_create_pre_meeting_note_use_case
    ),
) -> PreMeetingNoteResponse:
    try:
        note = use_case.execute(
            session_id=body.session_id,
            user_id=user.id,
            role_target=body.role_target,
            company_context=body.company_context,
            job_description=body.job_description,
            probing_questions=tuple(body.probing_questions),
            prep_checklist=tuple(body.prep_checklist),
            raw_user_input=body.raw_user_input,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return PreMeetingNoteResponse.from_domain(note)


@router.get(
    "/api/sessions/{session_id}/pre-meeting-note",
    response_model=PreMeetingNoteResponse,
)
async def get_pre_meeting_note_for_session(
    session_id: str,
    user: User = Depends(get_current_user),
    use_case: GetPreMeetingNoteUseCase = Depends(
        get_get_pre_meeting_note_use_case
    ),
) -> PreMeetingNoteResponse:
    try:
        note = use_case.execute(session_id=session_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    if note is None:
        raise HTTPException(
            status_code=404,
            detail="No hay preparación asociada a esta sesión.",
        )
    return PreMeetingNoteResponse.from_domain(note)
