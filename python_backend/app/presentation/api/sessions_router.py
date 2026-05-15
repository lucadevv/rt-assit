"""Sessions REST endpoints (B1 + B2).

B1 routes:
  POST   /api/sessions                                        — create
  GET    /api/sessions                                        — list (paginated)
  GET    /api/sessions/active                                 — recover (FR-22)
  GET    /api/sessions/{session_id}                           — detail (transcripts + hints + speakers)
  PATCH  /api/sessions/{session_id}                           — update title/summary/etc
  POST   /api/sessions/{session_id}/end                       — end (sets ended_at + duration)
  DELETE /api/sessions/{session_id}                           — soft delete
  POST   /api/sessions/{session_id}/speakers/{deepgram_id}/rename — rename speaker label
  POST   /api/sessions/{session_id}/tags                      — add tag
  DELETE /api/sessions/{session_id}/tags/{tag}                — remove tag

B2 routes (post-call):
  GET    /api/sessions/{session_id}/summary                   — fetch summary + action items (200 ready / 202 pending)
  POST   /api/sessions/{session_id}/regenerate-summary        — re-run LLM (background)
  GET    /api/sessions/{session_id}/transcript/search?q=...   — FTS5 search
  PATCH  /api/transcripts/{transcript_id}                     — edit transcript line (with audit)
  GET    /api/sessions/{session_id}/export?format=md|pdf      — download Markdown / PDF

All routes require auth via ``get_current_user`` (dev mode synthesises a default
user when AUTH_MODE=dev). Multi-tenant: every operation scopes by user.id."""
from __future__ import annotations

import logging
from typing import Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Response

from app.application.use_cases.add_session_tag import AddSessionTagUseCase
from app.application.use_cases.create_session import CreateSessionUseCase
from app.application.use_cases.delete_session import DeleteSessionUseCase
from app.application.use_cases.edit_transcript import EditTranscriptUseCase
from app.application.use_cases.end_session import EndSessionUseCase
from app.application.use_cases.export_session import ExportSessionUseCase
from app.application.use_cases.generate_session_summary import (
    GenerateSessionSummaryUseCase,
)
from app.application.use_cases.get_session import GetSessionUseCase
from app.application.use_cases.list_sessions import ListSessionsUseCase
from app.application.use_cases.list_speakers import ListSpeakersUseCase
from app.application.use_cases.merge_speakers import MergeSpeakersUseCase
from app.application.use_cases.recover_active_session import (
    RecoverActiveSessionUseCase,
)
from app.application.use_cases.regenerate_summary import RegenerateSummaryUseCase
from app.application.use_cases.remove_session_tag import RemoveSessionTagUseCase
from app.application.use_cases.rename_speaker import RenameSpeakerUseCase
from app.application.use_cases.search_transcripts import SearchTranscriptsUseCase
from app.application.use_cases.update_session import UpdateSessionUseCase
from app.domain.entities.user import User
from app.domain.exceptions import (
    GoneError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
)
from app.presentation.api.schemas import (
    CreateSessionRequest,
    DeleteResponse,
    EditTranscriptRequest,
    HintResponse,
    MergeSpeakersRequest,
    RenameSpeakerRequest,
    SessionDetailResponse,
    SessionResponse,
    SessionSummaryResponse,
    SessionTagRequest,
    SpeakerResponse,
    TranscriptResponse,
    TranscriptSearchResponse,
    UpdateSessionRequest,
)
from app.presentation.auth.middleware import get_current_user
from app.presentation.deps import (
    build_generate_session_summary_use_case,
    get_add_session_tag_use_case,
    get_create_session_use_case,
    get_delete_session_use_case,
    get_edit_transcript_use_case,
    get_end_session_use_case,
    get_export_session_use_case,
    get_get_session_use_case,
    get_list_sessions_use_case,
    get_list_speakers_use_case,
    get_merge_speakers_use_case,
    get_recover_active_session_use_case,
    get_regenerate_summary_use_case,
    get_remove_session_tag_use_case,
    get_rename_speaker_use_case,
    get_search_transcripts_use_case,
    get_session_state_registry,
    get_update_session_use_case,
)
from app.application.services.transcript_session_state import (
    SessionStateRegistry,
)


logger = logging.getLogger(__name__)


router = APIRouter()


# ---------------------------------------------------------------------------
# B1 endpoints
# ---------------------------------------------------------------------------


@router.post("/api/sessions", response_model=SessionResponse)
async def create_session(
    body: CreateSessionRequest,
    user: User = Depends(get_current_user),
    use_case: CreateSessionUseCase = Depends(get_create_session_use_case),
) -> SessionResponse:
    # B5 — tier gating: free tier has max_minutes_per_month limit, others
    # are unlimited. We check the monthly minute budget BEFORE creating.
    from app.application.use_cases.check_tier_limits import (
        CheckTierLimitsUseCase,
    )
    from app.domain.exceptions import UpgradeRequiredError
    from app.presentation.api.billing_router import upgrade_required_to_http
    from app.presentation.deps import (
        get_plans_repository,
        get_subscriptions_repository,
        get_usage_repository,
    )

    try:
        check = CheckTierLimitsUseCase(
            subscriptions_repo=get_subscriptions_repository(),
            plans_repo=get_plans_repository(),
            usage_repo=get_usage_repository(),
        )
        check.execute(
            user_id=user.id, limit="max_minutes_per_month", increment=0
        )
    except UpgradeRequiredError as e:
        raise upgrade_required_to_http(e) from e
    except Exception as e:  # noqa: BLE001 — never block on transient errors
        logger.warning(f"[Session] tier gate skipped: {e}")

    try:
        session = use_case.execute(
            user_id=user.id,
            scenario=body.scenario,
            my_language=body.my_language,
            other_language=body.other_language,
            is_recording=body.is_recording,
            title=body.title,
            metadata=body.metadata,
            mode=body.mode,
            meeting_id=body.meeting_id,
        )
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # B5 — track sessions_count
    try:
        from app.presentation.deps import build_increment_sessions_count_use_case

        build_increment_sessions_count_use_case().execute(user_id=user.id)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"[Usage] sessions_count increment failed: {e}")

    return SessionResponse.from_domain(session)


@router.get("/api/sessions", response_model=list[SessionResponse])
async def list_sessions(
    scenario: Optional[str] = None,
    search: Optional[str] = None,
    limit: int = Query(default=20, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    user: User = Depends(get_current_user),
    use_case: ListSessionsUseCase = Depends(get_list_sessions_use_case),
) -> list[SessionResponse]:
    sessions = use_case.execute(
        user_id=user.id,
        scenario=scenario,
        search=search,
        limit=limit,
        offset=offset,
    )
    return [SessionResponse.from_domain(s) for s in sessions]


@router.get("/api/sessions/active", response_model=Optional[SessionResponse])
async def recover_active_session(
    user: User = Depends(get_current_user),
    use_case: RecoverActiveSessionUseCase = Depends(
        get_recover_active_session_use_case
    ),
) -> Optional[SessionResponse]:
    """FR-22: returns ongoing session if any, else null."""
    session = use_case.execute(user_id=user.id)
    return SessionResponse.from_domain(session) if session else None


# B2 search endpoint MUST be declared BEFORE the wildcard /api/sessions/{id}
# routes; otherwise FastAPI matches the first one and treats "transcript" as
# a session id. Same goes for /summary, /regenerate-summary, /export — all
# declared above the catch-all detail handler.


@router.get(
    "/api/sessions/{session_id}/transcript/search",
    response_model=TranscriptSearchResponse,
)
async def search_transcripts(
    session_id: str,
    q: str = Query(..., min_length=1, max_length=200),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    use_case: SearchTranscriptsUseCase = Depends(get_search_transcripts_use_case),
) -> TranscriptSearchResponse:
    """FTS5 search scoped to one session (multi-tenant safe)."""
    results = use_case.execute(
        user_id=user.id,
        query=q,
        session_id=session_id,
        limit=limit,
    )
    return TranscriptSearchResponse(
        query=q,
        session_id=session_id,
        count=len(results),
        results=[TranscriptResponse.from_domain(t) for t in results],
    )


@router.get(
    "/api/sessions/{session_id}/summary",
    response_model=SessionSummaryResponse,
)
async def get_session_summary(
    session_id: str,
    response: Response,
    user: User = Depends(get_current_user),
    use_case: GetSessionUseCase = Depends(get_get_session_use_case),
) -> SessionSummaryResponse:
    """Returns 200 with summary + action_items if ready, else 202 Accepted."""
    try:
        detail = use_case.execute(session_id=session_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    s = detail.session
    ready = bool(s.summary)
    if not ready:
        response.status_code = 202
    return SessionSummaryResponse(
        session_id=s.id,
        ready=ready,
        summary=s.summary,
        action_items=list(s.action_items),
    )


@router.post(
    "/api/sessions/{session_id}/regenerate-summary",
    response_model=SessionResponse,
)
async def regenerate_summary(
    session_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    get_use_case: GetSessionUseCase = Depends(get_get_session_use_case),
    regenerate: RegenerateSummaryUseCase = Depends(get_regenerate_summary_use_case),
) -> SessionResponse:
    """Re-run summary generation in the background. Returns the current session row;
    the caller should poll GET /summary to observe the new summary appearing."""
    try:
        detail = get_use_case.execute(session_id=session_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    background_tasks.add_task(
        _run_summary_safely, regenerate.generate, session_id, user.id
    )
    return SessionResponse.from_domain(detail.session)


@router.get("/api/sessions/{session_id}/export")
async def export_session(
    session_id: str,
    format: str = Query(default="md"),
    user: User = Depends(get_current_user),
    use_case: ExportSessionUseCase = Depends(get_export_session_use_case),
) -> Response:
    try:
        content, mimetype = use_case.execute(
            session_id=session_id, user_id=user.id, format=format
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    ext = "pdf" if mimetype == "application/pdf" else "md"
    filename = f"session_{session_id}.{ext}"
    return Response(
        content=content,
        media_type=mimetype,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
        },
    )


@router.get(
    "/api/sessions/{session_id}", response_model=SessionDetailResponse
)
async def get_session(
    session_id: str,
    user: User = Depends(get_current_user),
    use_case: GetSessionUseCase = Depends(get_get_session_use_case),
) -> SessionDetailResponse:
    try:
        detail = use_case.execute(session_id=session_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    scenario_id = detail.session.scenario

    # Sprint 1.5 — enrich the session response with meeting metadata when
    # the row has an associated Meeting. A side fetch against the meetings
    # repo keeps this concern out of GetSessionUseCase (which doesn't take
    # a meetings_repo); the cost is one extra SQL read, only when the FK is
    # set. Failures here degrade silently — the session shape stays valid
    # without the meeting fields.
    session_payload = SessionResponse.from_domain(detail.session)
    if detail.session.meeting_id:
        try:
            from app.presentation.deps import get_meetings_repository

            meetings_repo = get_meetings_repository()
            meeting = meetings_repo.get(detail.session.meeting_id)
            if meeting is not None and meeting.user_id == user.id:
                session_payload = session_payload.model_copy(
                    update={
                        "meeting_url": meeting.join_url,
                        "meeting_code": _extract_meeting_code(meeting.join_url),
                    }
                )
        except Exception as e:  # noqa: BLE001 — never block detail on enrichment
            logger.warning(
                "[Sessions] meeting enrichment failed for session=%s: %s",
                detail.session.id,
                e,
            )

    return SessionDetailResponse(
        session=session_payload,
        transcripts=[TranscriptResponse.from_domain(t) for t in detail.transcripts],
        hints=[HintResponse.from_domain(h) for h in detail.hints],
        speakers=[
            SpeakerResponse.from_domain(s, scenario_id=scenario_id)
            for s in detail.speakers
        ],
        tags=list(detail.tags),
    )


def _extract_meeting_code(join_url: str) -> Optional[str]:
    """Return the human-readable code from a meeting URL.

    For Google Meet, ``https://meet.google.com/abc-defg-hij`` -> ``abc-defg-hij``.
    Falls back to ``None`` if the URL doesn't match the expected shape. Used by
    the SessionDetail enrichment so the live UI can render the code without
    re-parsing the URL on the client."""
    try:
        from urllib.parse import urlparse

        parsed = urlparse(join_url)
        path = (parsed.path or "").strip("/")
        return path if path else None
    except Exception:  # noqa: BLE001
        return None


@router.patch("/api/sessions/{session_id}", response_model=SessionResponse)
async def update_session(
    session_id: str,
    body: UpdateSessionRequest,
    user: User = Depends(get_current_user),
    use_case: UpdateSessionUseCase = Depends(get_update_session_use_case),
) -> SessionResponse:
    try:
        session = use_case.execute(
            session_id=session_id,
            user_id=user.id,
            title=body.title,
            summary=body.summary,
            action_items=body.action_items,
            metadata=body.metadata,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return SessionResponse.from_domain(session)


@router.post("/api/sessions/{session_id}/end", response_model=SessionResponse)
async def end_session(
    session_id: str,
    background_tasks: BackgroundTasks,
    user: User = Depends(get_current_user),
    use_case: EndSessionUseCase = Depends(get_end_session_use_case),
    session_state_registry: SessionStateRegistry = Depends(
        get_session_state_registry
    ),
) -> SessionResponse:
    """Ends the session immediately and schedules summary generation as a
    FastAPI BackgroundTask (runs after the response is sent). The summary
    use case is built outside the request scope (see deps.py) so it doesn't
    rely on a `Depends` context that has already been torn down.

    Idempotency: calling end on an already-ended session returns 200 with
    the same session entity (no DB write, no error). Soft-deleted sessions
    return 410 Gone; truly missing sessions return 404."""
    try:
        result = use_case.execute(session_id=session_id, user_id=user.id)
    except GoneError as e:
        raise HTTPException(status_code=410, detail=str(e)) from e
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    session = result.session

    # Side effects (summary background task + usage counters) only fire on
    # the FIRST successful close. On an idempotent retry the use case
    # returns was_already_ended=True and we skip them entirely — the
    # original close already triggered them.
    if not result.was_already_ended:
        if not session.summary:
            try:
                summary_use_case = build_generate_session_summary_use_case()
            except Exception as e:  # pragma: no cover — config error
                logger.exception(
                    "[B2] Could not build summary use case (LLM not configured?): %s",
                    e,
                )
            else:
                background_tasks.add_task(
                    _run_summary_safely, summary_use_case, session_id, user.id
                )

        # B5 — usage tracking: increment minutes + sessions_completed.
        try:
            from app.presentation.deps import (
                build_increment_minutes_use_case,
                build_increment_sessions_completed_use_case,
            )

            minutes = (session.duration_seconds or 0) // 60
            if minutes > 0:
                build_increment_minutes_use_case().execute(
                    user_id=user.id, minutes=minutes
                )
            build_increment_sessions_completed_use_case().execute(user_id=user.id)
        except Exception as e:  # noqa: BLE001
            logger.warning(f"[Usage] end-session counters failed: {e}")

    # Clean up the per-session conversation state — history buffer, pending
    # transcripts, in-flight LLM Task slot. Without this, state from this
    # session leaks into the NEXT session that happens to reuse a session
    # state slot, manifesting as "audio from previous session bleeding
    # through" (the user-reported bug). Pop is idempotent if the registry
    # has no entry for this id.
    session_state_registry.pop(session_id)

    return SessionResponse.from_domain(session)


@router.delete("/api/sessions/{session_id}", response_model=DeleteResponse)
async def delete_session(
    session_id: str,
    user: User = Depends(get_current_user),
    use_case: DeleteSessionUseCase = Depends(get_delete_session_use_case),
    session_state_registry: SessionStateRegistry = Depends(
        get_session_state_registry
    ),
) -> DeleteResponse:
    try:
        use_case.execute(session_id=session_id, user_id=user.id)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    # Same cleanup rationale as end_session — drop any leftover in-memory
    # conversation state so a future session never inherits its buffers.
    session_state_registry.pop(session_id)
    return DeleteResponse(deleted=True)


# ---------------------------------------------------------------------------
# B3 — Speakers / Diarization endpoints
#
# /speakers (list), /speakers/merge (B3 merge), /speakers/{id}/rename (B1 +
# B3 broadcast). The /merge route is declared BEFORE the wildcard
# /speakers/{deepgram_id}/rename so FastAPI doesn't try to match "merge" as
# an integer deepgram_id.
# ---------------------------------------------------------------------------


@router.get(
    "/api/sessions/{session_id}/speakers",
    response_model=list[SpeakerResponse],
)
async def list_speakers(
    session_id: str,
    user: User = Depends(get_current_user),
    use_case: ListSpeakersUseCase = Depends(get_list_speakers_use_case),
) -> list[SpeakerResponse]:
    try:
        session, speakers = use_case.execute(
            session_id=session_id, user_id=user.id
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return [
        SpeakerResponse.from_domain(s, scenario_id=session.scenario)
        for s in speakers
    ]


@router.post(
    "/api/sessions/{session_id}/speakers/merge",
    response_model=list[SpeakerResponse],
)
async def merge_speakers(
    session_id: str,
    body: MergeSpeakersRequest,
    user: User = Depends(get_current_user),
    merge_use_case: MergeSpeakersUseCase = Depends(get_merge_speakers_use_case),
    list_use_case: ListSpeakersUseCase = Depends(get_list_speakers_use_case),
) -> list[SpeakerResponse]:
    """Assign the same label to multiple deepgram speaker ids (B3)."""
    try:
        speakers = await merge_use_case.execute(
            session_id=session_id,
            user_id=user.id,
            label=body.label,
            deepgram_speaker_ids=body.deepgram_speaker_ids,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e

    # Re-read the session for the scenario color hint (publisher already
    # broadcast — this is just for the HTTP response).
    session, _ = list_use_case.execute(session_id=session_id, user_id=user.id)
    return [
        SpeakerResponse.from_domain(s, scenario_id=session.scenario)
        for s in speakers
    ]


@router.post(
    "/api/sessions/{session_id}/speakers/{deepgram_id}/rename",
    response_model=SpeakerResponse,
)
async def rename_speaker(
    session_id: str,
    deepgram_id: int,
    body: RenameSpeakerRequest,
    user: User = Depends(get_current_user),
    use_case: RenameSpeakerUseCase = Depends(get_rename_speaker_use_case),
    list_use_case: ListSpeakersUseCase = Depends(get_list_speakers_use_case),
) -> SpeakerResponse:
    try:
        speaker = await use_case.execute(
            session_id=session_id,
            user_id=user.id,
            deepgram_speaker_id=deepgram_id,
            label=body.label,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e

    # Pull scenario_id for the color hint without re-querying the use case
    # logic. list_speakers verifies ownership again so it's safe.
    session, _ = list_use_case.execute(session_id=session_id, user_id=user.id)
    return SpeakerResponse.from_domain(speaker, scenario_id=session.scenario)


@router.post("/api/sessions/{session_id}/tags", response_model=DeleteResponse)
async def add_tag(
    session_id: str,
    body: SessionTagRequest,
    user: User = Depends(get_current_user),
    use_case: AddSessionTagUseCase = Depends(get_add_session_tag_use_case),
) -> DeleteResponse:
    try:
        use_case.execute(session_id=session_id, user_id=user.id, tag=body.tag)
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    # Reuse DeleteResponse shape for "ok": True/False
    return DeleteResponse(deleted=True)


@router.delete(
    "/api/sessions/{session_id}/tags/{tag}", response_model=DeleteResponse
)
async def remove_tag(
    session_id: str,
    tag: str,
    user: User = Depends(get_current_user),
    use_case: RemoveSessionTagUseCase = Depends(get_remove_session_tag_use_case),
) -> DeleteResponse:
    try:
        removed = use_case.execute(session_id=session_id, user_id=user.id, tag=tag)
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    return DeleteResponse(deleted=removed)


# ---------------------------------------------------------------------------
# B2 transcript editing endpoint — top-level resource since transcripts
# are addressed by their own integer id, not by session+id.
# ---------------------------------------------------------------------------


@router.patch("/api/transcripts/{transcript_id}", response_model=TranscriptResponse)
async def edit_transcript(
    transcript_id: int,
    body: EditTranscriptRequest,
    user: User = Depends(get_current_user),
    use_case: EditTranscriptUseCase = Depends(get_edit_transcript_use_case),
) -> TranscriptResponse:
    try:
        updated = use_case.execute(
            transcript_id=transcript_id,
            user_id=user.id,
            new_content=body.content,
            reason=body.reason,
        )
    except NotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except UnauthorizedError as e:
        raise HTTPException(status_code=403, detail=str(e)) from e
    except ValidationError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    return TranscriptResponse.from_domain(updated)


# ---------------------------------------------------------------------------
# Background task helpers
# ---------------------------------------------------------------------------


async def _run_summary_safely(
    use_case: GenerateSessionSummaryUseCase,
    session_id: str,
    user_id: str,
) -> None:
    """Runs in BackgroundTasks. Catches all errors so a failed summary
    doesn't poison the event loop or surface 500s back to the user (the
    response has already been sent by then)."""
    try:
        await use_case.execute(session_id=session_id, user_id=user_id)
    except Exception as e:  # pragma: no cover — best-effort logging
        logger.error(
            "[B2] Failed to generate summary for session=%s user=%s: %s",
            session_id,
            user_id,
            e,
            exc_info=True,
        )
