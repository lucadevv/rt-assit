"""Pydantic request/response schemas for the HTTP API.

Lives at the presentation layer because these are transport-level contracts,
not business rules — domain entities (Document, Scenario) deliberately stay
plain dataclasses so they don't depend on Pydantic."""
from datetime import datetime
from typing import Any, Literal, Optional

from pydantic import BaseModel, Field

from app.domain.entities.hint import Hint
from app.domain.entities.integration import Integration
from app.domain.entities.invoice import Invoice
from app.domain.entities.payment_method import PaymentMethod
from app.domain.entities.persisted_transcript import PersistedTranscript
from app.domain.entities.persona import Persona
from app.domain.entities.plan import Plan
from app.domain.entities.session_material import SessionMaterial
from app.domain.entities.promo_code import PromoCode
from app.domain.entities.recording import Recording
from app.domain.entities.session import Session
from app.domain.entities.share_link import ShareLink
from app.domain.entities.speaker import Speaker
from app.domain.entities.subscription import Subscription
from app.domain.entities.usage_record import UsageRecord
from app.domain.entities.user import User
from app.domain.entities.user_preferences import UserPreferences


class UploadFileResponse(BaseModel):
    id: int
    title: str
    doc_type: str
    scenario: Optional[str]
    size_chars: int


class UploadURLRequest(BaseModel):
    url: str
    doc_type: str
    scenario: Optional[str] = None


class UploadTextRequest(BaseModel):
    title: str
    text: str
    doc_type: str
    scenario: Optional[str] = None


class UpdateDocumentRequest(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    # Wave 2A — "Principal" toggle from the /app/knowledge UI. ``None``
    # means "leave as-is"; ``True``/``False`` set the flag (and the use
    # case cascades to unmark other identity-doc primaries within scope).
    is_primary: Optional[bool] = None


class DocumentSummary(BaseModel):
    id: int
    doc_type: str
    scenario: Optional[str]
    title: str
    source: Optional[str]
    uploaded_at: Optional[str]
    size_chars: int
    metadata: dict[str, Any]


class DocumentDetail(BaseModel):
    id: int
    doc_type: str
    scenario: Optional[str]
    title: str
    content: str
    source: Optional[str]
    uploaded_at: Optional[str]
    metadata: dict[str, Any]


class DeleteResponse(BaseModel):
    deleted: bool


class ScenarioSummary(BaseModel):
    id: str
    label: str
    doc_types: list[str]
    description: str = ""
    color: str = "lime"


# ---------------------------------------------------------------------------
# B0 — User & Preferences schemas
# ---------------------------------------------------------------------------


class UserResponse(BaseModel):
    id: str
    email: str
    name: Optional[str] = None
    avatar_url: Optional[str] = None
    tier: str
    language_preferred: str
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, user: User) -> "UserResponse":
        return cls(
            id=user.id,
            email=user.email,
            name=user.name,
            avatar_url=user.avatar_url,
            tier=user.tier,
            language_preferred=user.language_preferred,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )


class UpdateMeRequest(BaseModel):
    name: Optional[str] = Field(default=None, max_length=200)
    language_preferred: Optional[str] = Field(default=None, max_length=20)


class UserPreferencesResponse(BaseModel):
    user_id: str
    theme: str
    density: str
    default_layout: str
    default_hint_style: str
    default_transcript_style: str
    default_scenario: str
    auto_delete_recordings_days: Optional[int] = None
    keyboard_shortcuts: dict[str, Any] = Field(default_factory=dict)
    audio_device_id: Optional[str] = None
    updated_at: Optional[datetime] = None

    @classmethod
    def from_domain(cls, prefs: UserPreferences) -> "UserPreferencesResponse":
        return cls(
            user_id=prefs.user_id,
            theme=prefs.theme,
            density=prefs.density,
            default_layout=prefs.default_layout,
            default_hint_style=prefs.default_hint_style,
            default_transcript_style=prefs.default_transcript_style,
            default_scenario=prefs.default_scenario,
            auto_delete_recordings_days=prefs.auto_delete_recordings_days,
            keyboard_shortcuts=prefs.keyboard_shortcuts,
            audio_device_id=prefs.audio_device_id,
            updated_at=prefs.updated_at,
        )


class UpdatePreferencesRequest(BaseModel):
    """Partial-patch payload for PATCH /api/preferences.

    ``audio_device_id`` admits explicit ``null`` to reset the field, so the
    router uses ``model_fields_set`` (Pydantic v2) to distinguish "missing
    from request" vs "explicit null". All other fields keep the
    "None = unchanged" semantic."""

    theme: Optional[str] = None
    density: Optional[str] = None
    default_layout: Optional[str] = None
    default_hint_style: Optional[str] = None
    default_transcript_style: Optional[str] = None
    default_scenario: Optional[str] = None
    auto_delete_recordings_days: Optional[int] = None
    keyboard_shortcuts: Optional[dict[str, Any]] = None
    audio_device_id: Optional[str] = None


class IntegrationResponse(BaseModel):
    """Response shape for GET /api/integrations (B4 placeholder).

    Credentials are NEVER serialised — the domain entity itself doesn't
    even carry them. metadata stays opaque to the client (provider may
    expose e.g. calendar id, slack workspace id)."""

    provider: str
    status: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    connected_at: Optional[datetime] = None
    disconnected_at: Optional[datetime] = None

    @classmethod
    def from_domain(cls, integration: Integration) -> "IntegrationResponse":
        return cls(
            provider=integration.provider,
            status=integration.status,
            metadata=integration.metadata,
            connected_at=integration.connected_at,
            disconnected_at=integration.disconnected_at,
        )


# ---------------------------------------------------------------------------
# B1 — Sessions / Transcripts / Hints / Speakers schemas
# ---------------------------------------------------------------------------


class CreateSessionRequest(BaseModel):
    scenario: str = Field(..., min_length=1, max_length=80)
    my_language: str = Field(..., min_length=1, max_length=20)
    other_language: str = Field(..., min_length=1, max_length=20)
    is_recording: bool = False
    title: Optional[str] = Field(default=None, max_length=200)
    metadata: Optional[dict[str, Any]] = None
    mode: Literal["agent", "scribe"] = "agent"
    """Session behaviour — ``agent`` (1st-person responses, default) vs
    ``scribe`` (3rd-person structured notes). Orthogonal to scenario:
    same scenario can run as either mode."""
    meeting_id: Optional[str] = Field(default=None, max_length=64)
    """Sprint 1.5 — optional FK to a previously-created Meeting row.
    When set, the backend verifies the meeting belongs to the same user
    before persisting the link."""


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = Field(default=None, max_length=200)
    summary: Optional[str] = None
    action_items: Optional[list[str]] = None
    metadata: Optional[dict[str, Any]] = None


class SessionResponse(BaseModel):
    id: str
    user_id: str
    scenario: str
    title: Optional[str] = None
    my_language: str
    other_language: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    is_recording: bool
    summary: Optional[str] = None
    action_items: list[str] = Field(default_factory=list)
    metadata: dict[str, Any] = Field(default_factory=dict)
    status: str
    mode: Literal["agent", "scribe"] = "agent"
    meeting_id: Optional[str] = None
    """Sprint 1.5 — optional id of the associated Meeting row."""
    meeting_url: Optional[str] = None
    """Sprint 1.5 — join URL of the associated meeting. Populated by the
    GET /api/sessions/{id} endpoint via a side lookup on the meetings repo
    so the live UI can render a MeetingInfoCard without a second round-trip."""
    meeting_code: Optional[str] = None
    """Sprint 1.5 — the meeting's human-readable code (e.g. ``abc-defg-hij``
    for Google Meet). Derived from ``join_url`` so the live UI doesn't have
    to parse the URL."""

    @classmethod
    def from_domain(cls, session: Session) -> "SessionResponse":
        return cls(
            id=session.id,
            user_id=session.user_id,
            scenario=session.scenario,
            title=session.title,
            my_language=session.my_language,
            other_language=session.other_language,
            started_at=session.started_at,
            ended_at=session.ended_at,
            duration_seconds=session.duration_seconds,
            is_recording=session.is_recording,
            summary=session.summary,
            action_items=list(session.action_items),
            metadata=dict(session.metadata),
            status=session.status,
            mode=session.mode,
            meeting_id=session.meeting_id,
        )


class TranscriptResponse(BaseModel):
    id: int
    session_id: str
    speaker_id: Optional[int] = None
    deepgram_speaker: Optional[int] = None
    content: str
    is_final: bool
    timestamp_ms: int
    language: Optional[str] = None
    confidence: Optional[float] = None

    @classmethod
    def from_domain(cls, t: PersistedTranscript) -> "TranscriptResponse":
        return cls(
            id=t.id,
            session_id=t.session_id,
            speaker_id=t.speaker_id,
            deepgram_speaker=t.deepgram_speaker,
            content=t.content,
            is_final=t.is_final,
            timestamp_ms=t.timestamp_ms,
            language=t.language,
            confidence=t.confidence,
        )


class HintResponse(BaseModel):
    id: int
    session_id: str
    related_transcript_id: Optional[int] = None
    content: str
    timestamp_ms: int

    @classmethod
    def from_domain(cls, h: Hint) -> "HintResponse":
        return cls(
            id=h.id,
            session_id=h.session_id,
            related_transcript_id=h.related_transcript_id,
            content=h.content,
            timestamp_ms=h.timestamp_ms,
        )


class SpeakerResponse(BaseModel):
    id: int
    session_id: str
    deepgram_speaker_id: int
    label: Optional[str] = None
    is_user: bool
    # B3 — semantic color name resolved from session.scenario. Frontend
    # maps cyan/amber/lavender/lime to actual hex via design tokens.
    color_hint: str = "lime"

    @classmethod
    def from_domain(
        cls, s: Speaker, scenario_id: Optional[str] = None
    ) -> "SpeakerResponse":
        # Local import to keep schema module light and avoid any cycles
        from app.domain.entities.scenario_color import get_scenario_color

        return cls(
            id=s.id,
            session_id=s.session_id,
            deepgram_speaker_id=s.deepgram_speaker_id,
            label=s.label,
            is_user=s.is_user,
            color_hint=get_scenario_color(scenario_id),
        )


class SessionDetailResponse(BaseModel):
    session: SessionResponse
    transcripts: list[TranscriptResponse] = Field(default_factory=list)
    hints: list[HintResponse] = Field(default_factory=list)
    speakers: list[SpeakerResponse] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class RenameSpeakerRequest(BaseModel):
    label: Optional[str] = Field(default=None, max_length=80)


class MergeSpeakersRequest(BaseModel):
    """Body for POST /api/sessions/{id}/speakers/merge (B3).

    Assigns the same ``label`` to every deepgram_speaker_id in the list.
    Used when Deepgram split the same physical speaker into multiple
    cluster ids and the user wants to unify them under one identity."""

    label: str = Field(..., min_length=1, max_length=80)
    deepgram_speaker_ids: list[int] = Field(..., min_length=1, max_length=20)


class SessionTagRequest(BaseModel):
    tag: str = Field(..., min_length=1, max_length=40)


# ---------------------------------------------------------------------------
# B2 — Post-call: summary, search, edit, export schemas
# ---------------------------------------------------------------------------


class SessionSummaryResponse(BaseModel):
    """Returned by GET /api/sessions/{id}/summary.

    ``ready`` is False while the background task is still running (HTTP
    202 Accepted). When True, ``summary`` and ``action_items`` are
    populated (HTTP 200)."""

    session_id: str
    ready: bool
    summary: Optional[str] = None
    action_items: list[str] = Field(default_factory=list)


class TranscriptSearchResponse(BaseModel):
    query: str
    session_id: Optional[str] = None
    count: int
    results: list[TranscriptResponse] = Field(default_factory=list)


class EditTranscriptRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=10000)
    reason: Optional[str] = Field(default=None, max_length=500)


# ---------------------------------------------------------------------------
# B5 — Billing schemas (plans, subscriptions, payment methods, invoices,
#       usage, promo codes)
# ---------------------------------------------------------------------------


class PlanResponse(BaseModel):
    id: str
    code: str
    name: str
    description: Optional[str] = None
    price_cents: int
    currency: str
    billing_cycle: str
    limits: dict[str, Any] = Field(default_factory=dict)
    is_active: bool = True
    is_legacy: bool = False
    sort_order: int = 0

    @classmethod
    def from_domain(cls, plan: Plan) -> "PlanResponse":
        return cls(
            id=plan.id,
            code=plan.code,
            name=plan.name,
            description=plan.description,
            price_cents=plan.price_cents,
            currency=plan.currency,
            billing_cycle=plan.billing_cycle,
            limits=dict(plan.limits),
            is_active=plan.is_active,
            is_legacy=plan.is_legacy,
            sort_order=plan.sort_order,
        )


class SubscriptionResponse(BaseModel):
    id: str
    user_id: str
    plan_id: str
    status: str
    lemon_squeezy_subscription_id: Optional[str] = None
    current_period_start: Optional[datetime] = None
    current_period_end: Optional[datetime] = None
    trial_start: Optional[datetime] = None
    trial_end: Optional[datetime] = None
    cancel_at_period_end: bool = False
    canceled_at: Optional[datetime] = None
    payment_failed_at: Optional[datetime] = None
    grace_period_end: Optional[datetime] = None
    pending_plan_id: Optional[str] = None
    promo_code_applied: Optional[str] = None
    discount_cents: int = 0

    @classmethod
    def from_domain(cls, sub: Subscription) -> "SubscriptionResponse":
        return cls(
            id=sub.id,
            user_id=sub.user_id,
            plan_id=sub.plan_id,
            status=sub.status,
            lemon_squeezy_subscription_id=sub.lemon_squeezy_subscription_id,
            current_period_start=sub.current_period_start,
            current_period_end=sub.current_period_end,
            trial_start=sub.trial_start,
            trial_end=sub.trial_end,
            cancel_at_period_end=sub.cancel_at_period_end,
            canceled_at=sub.canceled_at,
            payment_failed_at=sub.payment_failed_at,
            grace_period_end=sub.grace_period_end,
            pending_plan_id=sub.pending_plan_id,
            promo_code_applied=sub.promo_code_applied,
            discount_cents=sub.discount_cents,
        )


class PaymentMethodResponse(BaseModel):
    id: str
    type: str
    brand: Optional[str] = None
    last_four: Optional[str] = None
    exp_month: Optional[int] = None
    exp_year: Optional[int] = None
    is_default: bool = False
    is_active: bool = True

    @classmethod
    def from_domain(cls, pm: PaymentMethod) -> "PaymentMethodResponse":
        return cls(
            id=pm.id,
            type=pm.type,
            brand=pm.brand,
            last_four=pm.last_four,
            exp_month=pm.exp_month,
            exp_year=pm.exp_year,
            is_default=pm.is_default,
            is_active=pm.is_active,
        )


class InvoiceResponse(BaseModel):
    id: str
    subscription_id: Optional[str] = None
    invoice_number: Optional[str] = None
    subtotal_cents: int
    discount_cents: int
    tax_cents: int
    total_cents: int
    currency: str
    status: str
    period_start: Optional[datetime] = None
    period_end: Optional[datetime] = None
    issued_at: datetime
    paid_at: Optional[datetime] = None
    invoice_pdf_url: Optional[str] = None

    @classmethod
    def from_domain(cls, inv: Invoice) -> "InvoiceResponse":
        return cls(
            id=inv.id,
            subscription_id=inv.subscription_id,
            invoice_number=inv.invoice_number,
            subtotal_cents=inv.subtotal_cents,
            discount_cents=inv.discount_cents,
            tax_cents=inv.tax_cents,
            total_cents=inv.total_cents,
            currency=inv.currency,
            status=inv.status,
            period_start=inv.period_start,
            period_end=inv.period_end,
            issued_at=inv.issued_at,
            paid_at=inv.paid_at,
            invoice_pdf_url=inv.invoice_pdf_url,
        )


class UsageResponse(BaseModel):
    user_id: str
    period_start: datetime
    period_end: datetime
    minutes_used: int
    sessions_count: int
    sessions_completed: int
    docs_count: int
    storage_bytes_used: int
    share_links_created: int
    llm_input_tokens: int
    llm_output_tokens: int
    stt_audio_seconds: int
    cost_cents: int
    limit_hits: dict[str, Any] = Field(default_factory=dict)

    @classmethod
    def from_domain(cls, u: UsageRecord) -> "UsageResponse":
        return cls(
            user_id=u.user_id,
            period_start=u.period_start,
            period_end=u.period_end,
            minutes_used=u.minutes_used,
            sessions_count=u.sessions_count,
            sessions_completed=u.sessions_completed,
            docs_count=u.docs_count,
            storage_bytes_used=u.storage_bytes_used,
            share_links_created=u.share_links_created,
            llm_input_tokens=u.llm_input_tokens,
            llm_output_tokens=u.llm_output_tokens,
            stt_audio_seconds=u.stt_audio_seconds,
            cost_cents=u.cost_cents,
            limit_hits=dict(u.limit_hits),
        )


class UsageHistoryResponse(BaseModel):
    items: list[UsageResponse] = Field(default_factory=list)


class CheckoutRequest(BaseModel):
    plan_id: str = Field(..., min_length=1, max_length=80)
    promo_code: Optional[str] = Field(default=None, max_length=80)
    success_url: Optional[str] = Field(default=None, max_length=500)
    cancel_url: Optional[str] = Field(default=None, max_length=500)


class CheckoutResponse(BaseModel):
    checkout_url: str


class UpgradeRequest(BaseModel):
    plan_id: str = Field(..., min_length=1, max_length=80)


class DowngradeRequest(BaseModel):
    plan_id: str = Field(..., min_length=1, max_length=80)


class ChangeCycleRequest(BaseModel):
    to: str = Field(..., min_length=1, max_length=20)


class ValidatePromoRequest(BaseModel):
    code: str = Field(..., min_length=1, max_length=80)
    plan_id: Optional[str] = Field(default=None, max_length=80)


class PromoValidationResponse(BaseModel):
    valid: bool
    reason: Optional[str] = None
    code: Optional[str] = None
    discount_type: Optional[str] = None
    discount_value: Optional[int] = None

    @classmethod
    def from_validation(cls, validation) -> "PromoValidationResponse":
        promo: Optional[PromoCode] = validation.promo_code
        return cls(
            valid=validation.valid,
            reason=validation.reason,
            code=promo.code if promo else None,
            discount_type=promo.discount_type if promo else None,
            discount_value=promo.discount_value if promo else None,
        )


class PortalUrlResponse(BaseModel):
    url: Optional[str] = None


class WebhookAck(BaseModel):
    status: str
    event_id: Optional[str] = None


# ---------------------------------------------------------------------------
# B6 — Recordings (Pro+) schemas
# ---------------------------------------------------------------------------


class RecordingResponse(BaseModel):
    """Metadata for a session recording (Pro+ feature)."""

    session_id: str
    audio_format: str
    audio_duration_seconds: int
    audio_size_bytes: int
    expires_at: Optional[datetime] = None
    created_at: datetime

    @classmethod
    def from_domain(cls, recording: Recording) -> "RecordingResponse":
        return cls(
            session_id=recording.session_id,
            audio_format=recording.audio_format,
            audio_duration_seconds=recording.audio_duration_seconds,
            audio_size_bytes=recording.audio_size_bytes,
            expires_at=recording.expires_at,
            created_at=recording.created_at,
        )


class RecordingUrlResponse(BaseModel):
    url: str
    expires_seconds: int = 3600


class RecordingListItemResponse(BaseModel):
    """Recording joined with session metadata for the listing endpoint."""

    session_id: str
    audio_format: str
    audio_duration_seconds: int
    audio_size_bytes: int
    expires_at: Optional[datetime] = None
    created_at: datetime
    # Session-side fields
    session_title: Optional[str] = None
    scenario: str
    started_at: datetime
    ended_at: Optional[datetime] = None

    @classmethod
    def from_domain(
        cls, recording: Recording, session: Session
    ) -> "RecordingListItemResponse":
        return cls(
            session_id=recording.session_id,
            audio_format=recording.audio_format,
            audio_duration_seconds=recording.audio_duration_seconds,
            audio_size_bytes=recording.audio_size_bytes,
            expires_at=recording.expires_at,
            created_at=recording.created_at,
            session_title=session.title,
            scenario=session.scenario,
            started_at=session.started_at,
            ended_at=session.ended_at,
        )


# ---------------------------------------------------------------------------
# B7 — Share Links (Premium) schemas
# ---------------------------------------------------------------------------


import os as _os  # noqa: E402 — keep schemas.py imports tidy at top


_SHARE_PUBLIC_BASE_URL_DEFAULT = "http://localhost:5173/shared"


def _share_public_base_url() -> str:
    """Resolve the public share URL base (where the frontend renders the
    /shared/:id page). Read at request time so docker-compose can override."""
    return _os.getenv(
        "SHARE_PUBLIC_BASE_URL", _SHARE_PUBLIC_BASE_URL_DEFAULT
    ).rstrip("/")


class CreateShareLinkRequest(BaseModel):
    """Body for POST /api/sessions/{session_id}/share."""

    permissions: Literal["transcript_only", "with_audio", "edit"] = (
        "transcript_only"
    )
    expires_in_hours: Optional[int] = Field(default=None, ge=1, le=24 * 365)


class ShareLinkResponse(BaseModel):
    """Owner-facing response: includes the public_url so frontend can copy
    it to the clipboard. ``public_url`` is computed from
    ``SHARE_PUBLIC_BASE_URL`` env var + the link short-id."""

    id: str
    session_id: str
    permissions: str
    expires_at: Optional[datetime] = None
    revoked_at: Optional[datetime] = None
    view_count: int
    created_at: datetime
    public_url: str

    @classmethod
    def from_domain(cls, link: ShareLink) -> "ShareLinkResponse":
        base = _share_public_base_url()
        return cls(
            id=link.id,
            session_id=link.session_id,
            permissions=link.permissions,
            expires_at=link.expires_at,
            revoked_at=link.revoked_at,
            view_count=link.view_count,
            created_at=link.created_at,
            public_url=f"{base}/{link.id}",
        )


class SharedTranscriptItem(BaseModel):
    """Transcript line in the public-shared payload (no id leaking the
    internal numeric PK)."""

    id: int
    speaker_id: Optional[int] = None
    deepgram_speaker: Optional[int] = None
    content: str
    is_final: bool
    timestamp_ms: int
    language: Optional[str] = None
    confidence: Optional[float] = None


class SharedHintItem(BaseModel):
    id: int
    related_transcript_id: Optional[int] = None
    content: str
    timestamp_ms: int


class SharedSpeakerItem(BaseModel):
    id: int
    deepgram_speaker_id: int
    label: Optional[str] = None
    is_user: bool


class SharedSessionMeta(BaseModel):
    """Subset of Session fields safe to expose publicly. Notably excludes
    ``user_id`` (owner identity not surfaced) and ``deleted_at``."""

    id: str
    scenario: str
    title: Optional[str] = None
    my_language: str
    other_language: str
    started_at: datetime
    ended_at: Optional[datetime] = None
    duration_seconds: Optional[int] = None
    summary: Optional[str] = None
    action_items: list[str] = Field(default_factory=list)


class SharedSessionResponse(BaseModel):
    """Public-shared session payload returned by GET /api/public/share/:id.

    ``audio_url`` is only present when the link grants ``with_audio`` or
    ``edit`` permissions AND a recording exists for the session."""

    permissions: str
    session: SharedSessionMeta
    transcripts: list[SharedTranscriptItem]
    hints: list[SharedHintItem]
    speakers: list[SharedSpeakerItem]
    audio_url: Optional[str] = None

    @classmethod
    def from_dict(cls, payload: dict[str, Any]) -> "SharedSessionResponse":
        session: Session = payload["session"]
        transcripts: list[Any] = payload.get("transcripts", []) or []
        hints: list[Any] = payload.get("hints", []) or []
        speakers: list[Any] = payload.get("speakers", []) or []
        return cls(
            permissions=payload["permissions"],
            session=SharedSessionMeta(
                id=session.id,
                scenario=session.scenario,
                title=session.title,
                my_language=session.my_language,
                other_language=session.other_language,
                started_at=session.started_at,
                ended_at=session.ended_at,
                duration_seconds=session.duration_seconds,
                summary=session.summary,
                action_items=list(session.action_items or []),
            ),
            transcripts=[
                SharedTranscriptItem(
                    id=t.id,
                    speaker_id=t.speaker_id,
                    deepgram_speaker=t.deepgram_speaker,
                    content=t.content,
                    is_final=t.is_final,
                    timestamp_ms=t.timestamp_ms,
                    language=t.language,
                    confidence=t.confidence,
                )
                for t in transcripts
            ],
            hints=[
                SharedHintItem(
                    id=h.id,
                    related_transcript_id=h.related_transcript_id,
                    content=h.content,
                    timestamp_ms=h.timestamp_ms,
                )
                for h in hints
            ],
            speakers=[
                SharedSpeakerItem(
                    id=s.id,
                    deepgram_speaker_id=s.deepgram_speaker_id,
                    label=s.label,
                    is_user=s.is_user,
                )
                for s in speakers
            ],
            audio_url=payload.get("audio_url"),
        )


class RevokeShareLinkResponse(BaseModel):
    """Response for DELETE /api/share/:link_id."""

    revoked: bool


# ---------------------------------------------------------------------------
# B8 — Cross-cutting schemas (notifications, api keys, jobs, health)
# ---------------------------------------------------------------------------


from app.domain.entities.api_key import APIKey
from app.domain.entities.background_job import BackgroundJob
from app.domain.entities.notification import Notification


class NotificationResponse(BaseModel):
    id: int
    type: str
    channel: str
    title: str
    body: str
    metadata: dict[str, Any] = Field(default_factory=dict)
    read_at: Optional[datetime] = None
    sent_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_domain(cls, n: Notification) -> "NotificationResponse":
        return cls(
            id=n.id,
            type=n.type,
            channel=n.channel,
            title=n.title,
            body=n.body,
            metadata=n.metadata,
            read_at=n.read_at,
            sent_at=n.sent_at,
            created_at=n.created_at,
        )


class NotificationListResponse(BaseModel):
    items: list[NotificationResponse]
    unread_count: int


class MarkReadResponse(BaseModel):
    marked: int


class APIKeyResponse(BaseModel):
    """Public representation of a BYOK key — never includes ciphertext."""

    id: int
    provider: str
    key_hint: str
    is_active: bool
    last_used_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_domain(cls, k: APIKey) -> "APIKeyResponse":
        return cls(
            id=k.id,
            provider=k.provider,
            key_hint=k.key_hint,
            is_active=k.is_active,
            last_used_at=k.last_used_at,
            created_at=k.created_at,
        )


class AddAPIKeyRequest(BaseModel):
    provider: str
    key: str = Field(min_length=8)


class BackgroundJobResponse(BaseModel):
    id: str
    type: str
    payload: dict[str, Any] = Field(default_factory=dict)
    status: str
    attempts: int
    max_attempts: int
    error: Optional[str] = None
    scheduled_at: Optional[datetime] = None
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    created_at: Optional[datetime] = None

    @classmethod
    def from_domain(cls, j: BackgroundJob) -> "BackgroundJobResponse":
        return cls(
            id=j.id,
            type=j.type,
            payload=j.payload,
            status=j.status,
            attempts=j.attempts,
            max_attempts=j.max_attempts,
            error=j.error,
            scheduled_at=j.scheduled_at,
            started_at=j.started_at,
            completed_at=j.completed_at,
            created_at=j.created_at,
        )


class HealthResponse(BaseModel):
    """Aggregate health response for /health.

    Each key is a probe name (db/llm/storage/...) mapped to a status
    string. Status string values: ``"ok"``, ``"degraded"``, ``"down"``."""

    status: str
    checks: dict[str, str]


# ---------------------------------------------------------------------------
# H1 — Personas + Session materials schemas
# ---------------------------------------------------------------------------


PersonaToneLiteral = Literal["professional", "casual", "formal"]
SessionMaterialTypeLiteral = Literal[
    "brief", "agenda", "objective", "link", "note", "file"
]


class PersonaResponse(BaseModel):
    id: int
    user_id: str
    name: str
    description: Optional[str] = None
    scenario_id: Optional[str] = None
    icon: Optional[str] = None
    tone: Optional[PersonaToneLiteral] = None
    custom_instructions: Optional[str] = None
    is_default: bool
    created_at: datetime
    updated_at: datetime

    @classmethod
    def from_domain(cls, p: Persona) -> "PersonaResponse":
        return cls(
            id=p.id,
            user_id=p.user_id,
            name=p.name,
            description=p.description,
            scenario_id=p.scenario_id,
            icon=p.icon,
            tone=p.tone,  # type: ignore[arg-type]
            custom_instructions=p.custom_instructions,
            is_default=p.is_default,
            created_at=p.created_at,
            updated_at=p.updated_at,
        )


class CreatePersonaRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: Optional[str] = None
    scenario_id: Optional[str] = None
    icon: Optional[str] = Field(default=None, max_length=8)
    tone: Optional[PersonaToneLiteral] = None
    custom_instructions: Optional[str] = None
    is_default: bool = False


class UpdatePersonaRequest(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=200)
    description: Optional[str] = None
    scenario_id: Optional[str] = None
    icon: Optional[str] = Field(default=None, max_length=8)
    tone: Optional[PersonaToneLiteral] = None
    custom_instructions: Optional[str] = None


class LinkDocumentRequest(BaseModel):
    document_id: int
    is_identity: bool = False


class SessionMaterialResponse(BaseModel):
    id: int
    session_id: str
    material_type: SessionMaterialTypeLiteral
    title: Optional[str] = None
    content: Optional[str] = None
    source_url: Optional[str] = None
    created_at: datetime

    @classmethod
    def from_domain(cls, m: SessionMaterial) -> "SessionMaterialResponse":
        return cls(
            id=m.id,
            session_id=m.session_id,
            material_type=m.material_type,  # type: ignore[arg-type]
            title=m.title,
            content=m.content,
            source_url=m.source_url,
            created_at=m.created_at,
        )


class CreateSessionMaterialRequest(BaseModel):
    material_type: SessionMaterialTypeLiteral
    title: Optional[str] = Field(default=None, max_length=500)
    content: Optional[str] = None
    source_url: Optional[str] = Field(default=None, max_length=2000)
