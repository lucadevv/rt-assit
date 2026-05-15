"""FastAPI Depends() wiring — composition root for the HTTP/WS layer.

Each `get_*` factory is `@lru_cache(maxsize=1)`-decorated, which makes them
effective singletons (matches the previous global-instance behaviour). The
ConnectionManager + ConversationRepository need to be singletons so state
(WS clients, session memory) survives across requests."""
import os
from functools import lru_cache

from fastapi import Depends

from app.application.ports.auth_validator import AuthValidator
from app.application.ports.client_publisher import ClientPublisher
from app.application.ports.conversation_repository import ConversationRepository
from app.application.ports.document_extractor import DocumentExtractor, URLExtractor
from app.application.ports.documents_repository import DocumentsRepository
from app.application.ports.hints_repository import HintsRepository
from app.application.ports.integrations_repository import IntegrationsRepository
from app.application.ports.llm_provider import LLMProvider
from app.application.ports.scenario_repository import ScenarioRepository
from app.application.ports.session_event_publisher import SessionEventPublisher
from app.application.ports.session_exporter import SessionExporter
from app.application.ports.session_tags_repository import SessionTagsRepository
from app.application.ports.sessions_repository import SessionsRepository
from app.application.ports.speakers_repository import SpeakersRepository
from app.application.ports.transcript_corrections_repository import (
    TranscriptCorrectionsRepository,
)
from app.application.ports.transcripts_repository import TranscriptsRepository
from app.application.ports.user_preferences_repository import (
    UserPreferencesRepository,
)
from app.application.ports.users_repository import UsersRepository
from app.application.services.behavior_registry import BehaviorRegistry
from app.application.services.prompt_builder import PromptBuilder
from app.application.services.question_filter import QuestionFilter
from app.application.services.transcript_session_state import (
    SessionStateRegistry,
)
from app.application.use_cases.add_session_tag import AddSessionTagUseCase
from app.application.use_cases.create_session import CreateSessionUseCase
from app.application.use_cases.delete_document import DeleteDocumentUseCase
from app.application.use_cases.update_document import UpdateDocumentUseCase
from app.application.use_cases.delete_session import DeleteSessionUseCase
from app.application.use_cases.delete_user_data import DeleteUserDataUseCase
from app.application.use_cases.edit_transcript import EditTranscriptUseCase
from app.application.use_cases.end_session import EndSessionUseCase
from app.application.use_cases.ensure_user_exists import EnsureUserExistsUseCase
from app.application.use_cases.export_session import ExportSessionUseCase
from app.application.use_cases.generate_response import GenerateResponseUseCase
from app.application.use_cases.generate_session_summary import (
    GenerateSessionSummaryUseCase,
)
from app.application.use_cases.get_current_user import GetCurrentUserUseCase
from app.application.use_cases.get_document import GetDocumentUseCase
from app.application.use_cases.get_session import GetSessionUseCase
from app.application.use_cases.get_user_preferences import GetUserPreferencesUseCase
from app.application.use_cases.list_documents import ListDocumentsUseCase
from app.application.use_cases.list_integrations import ListIntegrationsUseCase
from app.application.use_cases.list_scenarios import ListScenariosUseCase
from app.application.use_cases.list_sessions import ListSessionsUseCase
from app.application.use_cases.list_speakers import ListSpeakersUseCase
from app.application.use_cases.merge_speakers import MergeSpeakersUseCase
from app.application.use_cases.persist_hint import PersistHintUseCase
from app.application.use_cases.persist_transcript import PersistTranscriptUseCase
from app.application.use_cases.process_transcript import ProcessTranscriptUseCase
from app.application.use_cases.recover_active_session import (
    RecoverActiveSessionUseCase,
)
from app.application.use_cases.register_speaker import RegisterSpeakerUseCase
from app.application.use_cases.regenerate_summary import RegenerateSummaryUseCase
from app.application.use_cases.remove_session_tag import RemoveSessionTagUseCase
from app.application.use_cases.rename_speaker import RenameSpeakerUseCase
from app.application.use_cases.search_transcripts import SearchTranscriptsUseCase
from app.application.use_cases.update_session import UpdateSessionUseCase
from app.application.use_cases.update_user_preferences import (
    UpdateUserPreferencesUseCase,
)
from app.application.use_cases.update_user_settings import UpdateUserSettingsUseCase
from app.application.use_cases.upload_document import UploadDocumentUseCase
from app.application.use_cases.upload_document_from_text import (
    UploadDocumentFromTextUseCase,
)
from app.application.use_cases.upload_document_from_url import (
    UploadDocumentFromURLUseCase,
)
from app.application.ports.personas_repository import PersonasRepository
from app.application.ports.session_materials_repository import (
    SessionMaterialsRepository,
)
from app.application.use_cases.create_persona import CreatePersonaUseCase
from app.application.use_cases.create_session_material import (
    CreateSessionMaterialUseCase,
)
from app.application.use_cases.delete_persona import DeletePersonaUseCase
from app.application.use_cases.delete_session_material import (
    DeleteSessionMaterialUseCase,
)
from app.application.use_cases.get_persona import GetPersonaUseCase
from app.application.use_cases.link_persona_document import (
    LinkPersonaDocumentUseCase,
)
from app.application.use_cases.list_personas import ListPersonasUseCase
from app.application.use_cases.list_session_materials import (
    ListSessionMaterialsUseCase,
)
from app.application.use_cases.set_default_persona import (
    SetDefaultPersonaUseCase,
)
from app.application.use_cases.unlink_persona_document import (
    UnlinkPersonaDocumentUseCase,
)
from app.application.use_cases.update_persona import UpdatePersonaUseCase
from app.infrastructure.persistence.sqlite.personas_repository import (
    SQLitePersonasRepository,
)
from app.infrastructure.persistence.sqlite.session_materials_repository import (
    SQLiteSessionMaterialsRepository,
)
from app.infrastructure.auth.auth_factory import (
    create_auth_validator,
    is_dev_mode as _is_dev_mode,
)
from app.infrastructure.exporters.default_session_exporter import (
    DefaultSessionExporter,
)
from app.infrastructure.extractors.extractor_dispatcher import build_default_dispatcher
from app.infrastructure.extractors.url_extractor import HTTPURLExtractor
from app.infrastructure.llm.factory import create_llm
from app.infrastructure.persistence.sqlite.conversation_repository import (
    InMemoryConversationRepository,
)
from app.infrastructure.persistence.sqlite.documents_repository import (
    SQLiteDocumentsRepository,
)
from app.infrastructure.persistence.sqlite.hints_repository import (
    SQLiteHintsRepository,
)
from app.infrastructure.persistence.sqlite.integrations_repository import (
    SQLiteIntegrationsRepository,
)
from app.infrastructure.persistence.sqlite.session_tags_repository import (
    SQLiteSessionTagsRepository,
)
from app.infrastructure.persistence.sqlite.sessions_repository import (
    SQLiteSessionsRepository,
)
from app.infrastructure.persistence.sqlite.speakers_repository import (
    SQLiteSpeakersRepository,
)
from app.infrastructure.persistence.sqlite.transcript_corrections_repository import (
    SQLiteTranscriptCorrectionsRepository,
)
from app.infrastructure.persistence.sqlite.transcripts_repository import (
    SQLiteTranscriptsRepository,
)
from app.infrastructure.persistence.sqlite.user_preferences_repository import (
    SQLiteUserPreferencesRepository,
)
from app.infrastructure.persistence.sqlite.users_repository import (
    SQLiteUsersRepository,
)
from app.infrastructure.scenarios.in_memory_scenario_repository import (
    InMemoryScenarioRepository,
)
from app.presentation.websocket.connection_manager import ConnectionManager


DEFAULT_SCENARIO = "interview_dev"


# ---------------------------------------------------------------------------
# Singletons (port-typed) — must persist across requests
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_documents_repository() -> DocumentsRepository:
    return SQLiteDocumentsRepository()


@lru_cache(maxsize=1)
def get_conversation_repository() -> ConversationRepository:
    return InMemoryConversationRepository()


@lru_cache(maxsize=1)
def get_scenarios_repository() -> ScenarioRepository:
    return InMemoryScenarioRepository()


@lru_cache(maxsize=1)
def get_llm_provider() -> LLMProvider:
    return create_llm()


@lru_cache(maxsize=1)
def get_extractor() -> DocumentExtractor:
    return build_default_dispatcher()


@lru_cache(maxsize=1)
def get_url_extractor() -> URLExtractor:
    return HTTPURLExtractor()


@lru_cache(maxsize=1)
def get_question_filter() -> QuestionFilter:
    return QuestionFilter()


@lru_cache(maxsize=1)
def get_behavior_registry() -> BehaviorRegistry:
    """Composition root for the per-scenario behavior policies.

    Fase A — Strategy Pattern: each scenario decides whether a given
    transcript warrants an LLM response, the coalesce window, greeting
    policy, and response token budget. Replaces the global
    `QuestionFilter.is_likely_filler` in `ProcessTranscriptUseCase`."""
    from app.infrastructure.scenarios.behaviors.client_call_behavior import (
        ClientCallBehavior,
    )
    from app.infrastructure.scenarios.behaviors.exam_oral_behavior import (
        ExamOralBehavior,
    )
    from app.infrastructure.scenarios.behaviors.interview_behavioral_behavior import (
        InterviewBehavioralBehavior,
    )
    from app.infrastructure.scenarios.behaviors.interview_dev_behavior import (
        InterviewDevBehavior,
    )
    from app.infrastructure.scenarios.behaviors.legal_client_call_behavior import (
        LegalClientCallBehavior,
    )
    from app.infrastructure.scenarios.behaviors.legal_hearing_behavior import (
        LegalHearingBehavior,
    )
    from app.infrastructure.scenarios.behaviors.legal_negotiation_behavior import (
        LegalNegotiationBehavior,
    )
    from app.infrastructure.scenarios.behaviors.meeting_business_behavior import (
        MeetingBusinessBehavior,
    )
    from app.infrastructure.scenarios.behaviors.personal_behavior import (
        PersonalBehavior,
    )
    from app.infrastructure.scenarios.behaviors.sales_call_behavior import (
        SalesCallBehavior,
    )
    from app.infrastructure.scenarios.behaviors.thesis_defense_behavior import (
        ThesisDefenseBehavior,
    )

    return BehaviorRegistry([
        InterviewDevBehavior(),
        InterviewBehavioralBehavior(),
        MeetingBusinessBehavior(),
        ClientCallBehavior(),
        SalesCallBehavior(),
        ExamOralBehavior(),
        ThesisDefenseBehavior(),
        LegalClientCallBehavior(),
        LegalNegotiationBehavior(),
        LegalHearingBehavior(),
        PersonalBehavior(),
    ])


@lru_cache(maxsize=1)
def get_session_state_registry() -> SessionStateRegistry:
    """Fase B — per-session in-memory state (history + in-flight LLM
    Task + pending buffer). Singleton so all WS handlers share it.

    ``history_limit=3`` matches the Fase B spec (last N=3 finals fed
    to ``ScenarioBehavior.should_respond`` as the ``history`` arg)."""
    return SessionStateRegistry(history_limit=3)


@lru_cache(maxsize=1)
def get_users_repository() -> UsersRepository:
    # Defined here (above its first use in get_prompt_builder + upload
    # factories) because FastAPI's Depends(get_users_repository) is
    # evaluated at module-import time, not at request time. The original
    # definition further down the file caused NameError on startup.
    return SQLiteUsersRepository()


@lru_cache(maxsize=1)
def get_prompt_builder() -> PromptBuilder:
    # Wave 2A — pass the UsersRepository singleton so PromptBuilder can
    # resolve ``{candidate_name}`` from the actual user record at
    # runtime instead of falling back to the CANDIDATE_NAME env var or
    # the generic placeholder. ``get_users_repository`` is itself
    # ``@lru_cache(maxsize=1)``-decorated so this is still a singleton.
    #
    # H2 — also wire personas_repo + session_materials_repo when the H1
    # SQLite implementations exist. H1 + H2 ship in parallel; while H1
    # isn't merged, the SQLite modules don't exist and the import
    # raises ``ImportError`` → we fall back to ``None`` for both repos
    # and PromptBuilder short-circuits to the legacy behavior (all
    # identity docs of relevant types, no session materials block, no
    # custom instructions). The persona_id is already threaded through
    # every layer of the call chain so this lazy import is the ONLY
    # remaining wire — once H1's SQLite modules land, the persona
    # system activates on the next process boot without any other
    # change in this file.
    personas_repo = None
    session_materials_repo = None
    try:
        from app.infrastructure.persistence.sqlite.personas_repository import (  # noqa: F401
            SQLitePersonasRepository,
        )
        personas_repo = SQLitePersonasRepository()
    except ImportError:
        pass
    try:
        from app.infrastructure.persistence.sqlite.session_materials_repository import (  # noqa: F401
            SQLiteSessionMaterialsRepository,
        )
        session_materials_repo = SQLiteSessionMaterialsRepository()
    except ImportError:
        pass
    return PromptBuilder(
        users_repo=get_users_repository(),
        personas_repo=personas_repo,
        session_materials_repo=session_materials_repo,
    )


@lru_cache(maxsize=1)
def get_connection_manager() -> ConnectionManager:
    return ConnectionManager()


def get_client_publisher(
    manager: ConnectionManager = Depends(get_connection_manager),
) -> ClientPublisher:
    return manager


def get_session_event_publisher(
    manager: ConnectionManager = Depends(get_connection_manager),
) -> SessionEventPublisher:
    """B3 — same singleton ConnectionManager exposed via the
    SessionEventPublisher port (for session-room broadcasts)."""
    return manager


# ---------------------------------------------------------------------------
# Use case factories
# ---------------------------------------------------------------------------


def get_upload_document_use_case(
    repo: DocumentsRepository = Depends(get_documents_repository),
    extractor: DocumentExtractor = Depends(get_extractor),
    users_repo: UsersRepository = Depends(get_users_repository),
) -> UploadDocumentUseCase:
    return UploadDocumentUseCase(repo, extractor, users_repo=users_repo)


def get_upload_document_from_url_use_case(
    repo: DocumentsRepository = Depends(get_documents_repository),
    url_extractor: URLExtractor = Depends(get_url_extractor),
    users_repo: UsersRepository = Depends(get_users_repository),
) -> UploadDocumentFromURLUseCase:
    return UploadDocumentFromURLUseCase(repo, url_extractor, users_repo=users_repo)


def get_upload_document_from_text_use_case(
    repo: DocumentsRepository = Depends(get_documents_repository),
    users_repo: UsersRepository = Depends(get_users_repository),
) -> UploadDocumentFromTextUseCase:
    return UploadDocumentFromTextUseCase(repo, users_repo=users_repo)


def get_list_documents_use_case(
    repo: DocumentsRepository = Depends(get_documents_repository),
) -> ListDocumentsUseCase:
    return ListDocumentsUseCase(repo)


def get_get_document_use_case(
    repo: DocumentsRepository = Depends(get_documents_repository),
) -> GetDocumentUseCase:
    return GetDocumentUseCase(repo)


def get_delete_document_use_case(
    repo: DocumentsRepository = Depends(get_documents_repository),
) -> DeleteDocumentUseCase:
    return DeleteDocumentUseCase(repo)


def get_update_document_use_case(
    repo: DocumentsRepository = Depends(get_documents_repository),
) -> UpdateDocumentUseCase:
    return UpdateDocumentUseCase(repo)


def get_list_scenarios_use_case(
    scenarios_repo: ScenarioRepository = Depends(get_scenarios_repository),
) -> ListScenariosUseCase:
    return ListScenariosUseCase(scenarios_repo)


def _resolve_scenario_id() -> str:
    return os.getenv("SCENARIO", DEFAULT_SCENARIO).strip() or DEFAULT_SCENARIO


def get_generate_response_use_case(
    llm: LLMProvider = Depends(get_llm_provider),
    conversation_repo: ConversationRepository = Depends(get_conversation_repository),
    prompt_builder: PromptBuilder = Depends(get_prompt_builder),
    scenarios_repo: ScenarioRepository = Depends(get_scenarios_repository),
    docs_repo: DocumentsRepository = Depends(get_documents_repository),
) -> GenerateResponseUseCase:
    return GenerateResponseUseCase(
        llm=llm,
        conversation_repo=conversation_repo,
        prompt_builder=prompt_builder,
        scenarios_repo=scenarios_repo,
        docs_repo=docs_repo,
        scenario_id=_resolve_scenario_id(),
    )


# Note: ProcessTranscriptUseCase is the orchestrator that ties together the
# WS pipeline + persistence (B1). It depends on the B1 sessions/transcripts/
# hints repos defined further below — the function is wired via direct
# singleton lookups (rather than chained Depends) so it can be reused from
# the WebSocket router which doesn't have a Request scope.
def get_process_transcript_use_case() -> ProcessTranscriptUseCase:
    return _build_process_transcript_use_case()


def _build_process_transcript_use_case() -> ProcessTranscriptUseCase:
    manager = get_connection_manager()
    docs_repo = get_documents_repository()
    conv_repo = get_conversation_repository()
    scenarios_repo = get_scenarios_repository()
    llm = get_llm_provider()
    prompt_builder = get_prompt_builder()
    behavior_registry = get_behavior_registry()
    scenario_id = _resolve_scenario_id()

    sessions_repo = get_sessions_repository()
    transcripts_repo = get_transcripts_repository()
    hints_repo = get_hints_repository()
    speakers_repo = get_speakers_repository()
    session_state_registry = get_session_state_registry()

    generate = GenerateResponseUseCase(
        llm=llm,
        conversation_repo=conv_repo,
        prompt_builder=prompt_builder,
        scenarios_repo=scenarios_repo,
        docs_repo=docs_repo,
        scenario_id=scenario_id,
    )
    persist_transcript = PersistTranscriptUseCase(transcripts_repo, speakers_repo)
    persist_hint = PersistHintUseCase(hints_repo)

    # Fase B — LangGraph orchestrator (compiled once, reused across all
    # WS turns). Importing here keeps top-of-file imports lean and lets
    # ``deps.py`` load even if langgraph is not yet installed locally
    # (the build/Docker image always has it).
    from app.application.services.transcript_graph import (
        build_transcript_graph,
    )

    graph_orchestrator = build_transcript_graph(
        behavior_registry=behavior_registry,
        scenario_id=scenario_id,
        generate_response=generate,
        conversation_repo=conv_repo,
        client_publisher=manager,
        sessions_repo=sessions_repo,
        persist_transcript=persist_transcript,
        persist_hint=persist_hint,
        session_state_registry=session_state_registry,
    )

    return ProcessTranscriptUseCase(
        behavior_registry=behavior_registry,
        scenario_id=scenario_id,
        generate_response=generate,
        conversation_repo=conv_repo,
        client_publisher=manager,
        sessions_repo=sessions_repo,
        persist_transcript=persist_transcript,
        persist_hint=persist_hint,
        graph_orchestrator=graph_orchestrator,
        session_state_registry=session_state_registry,
    )


# ---------------------------------------------------------------------------
# B0 — User & Auth singletons + use-case factories
# (get_users_repository is defined earlier — required by Wave 2A wiring.)
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_user_preferences_repository() -> UserPreferencesRepository:
    return SQLiteUserPreferencesRepository()


@lru_cache(maxsize=1)
def get_auth_validator() -> AuthValidator:
    return create_auth_validator()


def is_dev_mode() -> bool:
    """Re-exported via deps.py so middleware doesn't reach into infrastructure."""
    return _is_dev_mode()


def get_ensure_user_exists_use_case(
    users_repo: UsersRepository = Depends(get_users_repository),
) -> EnsureUserExistsUseCase:
    return EnsureUserExistsUseCase(users_repo)


def get_get_current_user_use_case(
    users_repo: UsersRepository = Depends(get_users_repository),
) -> GetCurrentUserUseCase:
    return GetCurrentUserUseCase(users_repo)


def get_update_user_settings_use_case(
    users_repo: UsersRepository = Depends(get_users_repository),
) -> UpdateUserSettingsUseCase:
    return UpdateUserSettingsUseCase(users_repo)


def get_delete_user_data_use_case(
    users_repo: UsersRepository = Depends(get_users_repository),
    prefs_repo: UserPreferencesRepository = Depends(get_user_preferences_repository),
    docs_repo: DocumentsRepository = Depends(get_documents_repository),
) -> DeleteUserDataUseCase:
    return DeleteUserDataUseCase(users_repo, prefs_repo, docs_repo)


def get_get_user_preferences_use_case(
    prefs_repo: UserPreferencesRepository = Depends(get_user_preferences_repository),
) -> GetUserPreferencesUseCase:
    return GetUserPreferencesUseCase(prefs_repo)


def get_update_user_preferences_use_case(
    prefs_repo: UserPreferencesRepository = Depends(get_user_preferences_repository),
) -> UpdateUserPreferencesUseCase:
    return UpdateUserPreferencesUseCase(prefs_repo)


# ---------------------------------------------------------------------------
# B4 — Integrations placeholder (read-only)
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_integrations_repository() -> IntegrationsRepository:
    return SQLiteIntegrationsRepository()


def get_list_integrations_use_case(
    integrations_repo: IntegrationsRepository = Depends(get_integrations_repository),
) -> ListIntegrationsUseCase:
    return ListIntegrationsUseCase(integrations_repo)


# Convenience factory for WebSocket handlers, where FastAPI Depends() injection
# isn't available on the receive loop. The websocket entry point can call this
# directly to assemble the use case.
def build_process_transcript_use_case() -> ProcessTranscriptUseCase:
    return _build_process_transcript_use_case()


# ---------------------------------------------------------------------------
# B1 — Sessions / Transcripts / Hints / Speakers / Tags singletons
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_sessions_repository() -> SessionsRepository:
    return SQLiteSessionsRepository()


@lru_cache(maxsize=1)
def get_transcripts_repository() -> TranscriptsRepository:
    return SQLiteTranscriptsRepository()


@lru_cache(maxsize=1)
def get_hints_repository() -> HintsRepository:
    return SQLiteHintsRepository()


@lru_cache(maxsize=1)
def get_speakers_repository() -> SpeakersRepository:
    return SQLiteSpeakersRepository()


@lru_cache(maxsize=1)
def get_session_tags_repository() -> SessionTagsRepository:
    return SQLiteSessionTagsRepository()


# ---------------------------------------------------------------------------
# B1 — Use-case factories
# ---------------------------------------------------------------------------


def get_create_session_use_case(
    repo: SessionsRepository = Depends(get_sessions_repository),
) -> CreateSessionUseCase:
    # Sprint 1.5: wire the meetings repo so the use case can verify
    # meeting ownership when a session is created with `meeting_id`.
    return CreateSessionUseCase(repo, meetings_repo=get_meetings_repository())


def get_get_session_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    transcripts_repo: TranscriptsRepository = Depends(get_transcripts_repository),
    hints_repo: HintsRepository = Depends(get_hints_repository),
    speakers_repo: SpeakersRepository = Depends(get_speakers_repository),
    tags_repo: SessionTagsRepository = Depends(get_session_tags_repository),
) -> GetSessionUseCase:
    return GetSessionUseCase(
        sessions_repo, transcripts_repo, hints_repo, speakers_repo, tags_repo
    )


def get_list_sessions_use_case(
    repo: SessionsRepository = Depends(get_sessions_repository),
) -> ListSessionsUseCase:
    return ListSessionsUseCase(repo)


def get_end_session_use_case(
    repo: SessionsRepository = Depends(get_sessions_repository),
) -> EndSessionUseCase:
    return EndSessionUseCase(repo)


def get_delete_session_use_case(
    repo: SessionsRepository = Depends(get_sessions_repository),
) -> DeleteSessionUseCase:
    return DeleteSessionUseCase(repo)


def get_recover_active_session_use_case(
    repo: SessionsRepository = Depends(get_sessions_repository),
) -> RecoverActiveSessionUseCase:
    return RecoverActiveSessionUseCase(repo)


def get_update_session_use_case(
    repo: SessionsRepository = Depends(get_sessions_repository),
) -> UpdateSessionUseCase:
    return UpdateSessionUseCase(repo)


def get_register_speaker_use_case(
    repo: SpeakersRepository = Depends(get_speakers_repository),
) -> RegisterSpeakerUseCase:
    return RegisterSpeakerUseCase(repo)


def get_rename_speaker_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    speakers_repo: SpeakersRepository = Depends(get_speakers_repository),
    event_publisher: SessionEventPublisher = Depends(get_session_event_publisher),
) -> RenameSpeakerUseCase:
    return RenameSpeakerUseCase(sessions_repo, speakers_repo, event_publisher)


def get_list_speakers_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    speakers_repo: SpeakersRepository = Depends(get_speakers_repository),
) -> ListSpeakersUseCase:
    return ListSpeakersUseCase(sessions_repo, speakers_repo)


def get_merge_speakers_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    speakers_repo: SpeakersRepository = Depends(get_speakers_repository),
    event_publisher: SessionEventPublisher = Depends(get_session_event_publisher),
) -> MergeSpeakersUseCase:
    return MergeSpeakersUseCase(sessions_repo, speakers_repo, event_publisher)


def get_persist_transcript_use_case(
    transcripts_repo: TranscriptsRepository = Depends(get_transcripts_repository),
    speakers_repo: SpeakersRepository = Depends(get_speakers_repository),
) -> PersistTranscriptUseCase:
    return PersistTranscriptUseCase(transcripts_repo, speakers_repo)


def get_persist_hint_use_case(
    hints_repo: HintsRepository = Depends(get_hints_repository),
) -> PersistHintUseCase:
    return PersistHintUseCase(hints_repo)


def get_add_session_tag_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    tags_repo: SessionTagsRepository = Depends(get_session_tags_repository),
) -> AddSessionTagUseCase:
    return AddSessionTagUseCase(sessions_repo, tags_repo)


def get_remove_session_tag_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    tags_repo: SessionTagsRepository = Depends(get_session_tags_repository),
) -> RemoveSessionTagUseCase:
    return RemoveSessionTagUseCase(sessions_repo, tags_repo)


# ---------------------------------------------------------------------------
# B2 — Post-call: summary, search, edit, export wiring
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_transcript_corrections_repository() -> TranscriptCorrectionsRepository:
    return SQLiteTranscriptCorrectionsRepository()


@lru_cache(maxsize=1)
def get_session_exporter() -> SessionExporter:
    return DefaultSessionExporter()


def get_generate_session_summary_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    transcripts_repo: TranscriptsRepository = Depends(get_transcripts_repository),
    speakers_repo: SpeakersRepository = Depends(get_speakers_repository),
    llm: LLMProvider = Depends(get_llm_provider),
) -> GenerateSessionSummaryUseCase:
    return GenerateSessionSummaryUseCase(
        sessions_repo, transcripts_repo, speakers_repo, llm
    )


def build_generate_session_summary_use_case() -> GenerateSessionSummaryUseCase:
    """Build the summary use case outside of a request scope.

    Used by the FastAPI ``BackgroundTasks`` dispatch in the sessions router:
    when a session ends, the response returns immediately while the LLM
    call runs in the background. Background coroutines do NOT have access
    to ``Depends`` injection, so we bypass it via direct singleton lookups."""
    return GenerateSessionSummaryUseCase(
        get_sessions_repository(),
        get_transcripts_repository(),
        get_speakers_repository(),
        get_llm_provider(),
    )


def get_regenerate_summary_use_case(
    generate: GenerateSessionSummaryUseCase = Depends(
        get_generate_session_summary_use_case
    ),
) -> RegenerateSummaryUseCase:
    return RegenerateSummaryUseCase(generate)


def get_search_transcripts_use_case(
    transcripts_repo: TranscriptsRepository = Depends(get_transcripts_repository),
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
) -> SearchTranscriptsUseCase:
    return SearchTranscriptsUseCase(transcripts_repo, sessions_repo)


def get_edit_transcript_use_case(
    transcripts_repo: TranscriptsRepository = Depends(get_transcripts_repository),
    corrections_repo: TranscriptCorrectionsRepository = Depends(
        get_transcript_corrections_repository
    ),
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
) -> EditTranscriptUseCase:
    return EditTranscriptUseCase(
        transcripts_repo, corrections_repo, sessions_repo
    )


def get_export_session_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    transcripts_repo: TranscriptsRepository = Depends(get_transcripts_repository),
    hints_repo: HintsRepository = Depends(get_hints_repository),
    speakers_repo: SpeakersRepository = Depends(get_speakers_repository),
    tags_repo: SessionTagsRepository = Depends(get_session_tags_repository),
    exporter: SessionExporter = Depends(get_session_exporter),
) -> ExportSessionUseCase:
    return ExportSessionUseCase(
        sessions_repo, transcripts_repo, hints_repo, speakers_repo, tags_repo, exporter
    )


# ---------------------------------------------------------------------------
# B5 — Billing & Subscriptions composition root
# ---------------------------------------------------------------------------


from app.application.ports.billing_audit_log_repository import (
    BillingAuditLogRepository,
)
from app.application.ports.billing_provider import BillingProvider
from app.application.ports.email_sender import EmailSender
from app.application.ports.invoices_repository import InvoicesRepository
from app.application.ports.payment_methods_repository import (
    PaymentMethodsRepository,
)
from app.application.ports.plans_repository import PlansRepository
from app.application.ports.promo_codes_repository import PromoCodesRepository
from app.application.ports.subscriptions_repository import (
    SubscriptionsRepository,
)
from app.application.ports.usage_repository import UsageRepository
from app.application.ports.webhook_events_repository import (
    WebhookEventsRepository,
)
from app.application.use_cases.cancel_subscription import (
    CancelSubscriptionUseCase,
)
from app.application.use_cases.change_billing_cycle import (
    ChangeBillingCycleUseCase,
)
from app.application.use_cases.check_tier_limits import (
    CheckTierLimitsUseCase,
    IsFeatureAvailableUseCase,
)
from app.application.use_cases.check_trial_expiration import (
    CheckTrialExpirationUseCase,
)
from app.application.use_cases.create_checkout_session import (
    CreateCheckoutSessionUseCase,
)
from app.application.use_cases.downgrade_subscription import (
    DowngradeSubscriptionUseCase,
)
from app.application.use_cases.get_current_usage import (
    GetCurrentUsageUseCase,
    GetUsageHistoryUseCase,
    ResetMonthlyUsageUseCase,
)
from app.application.use_cases.get_subscription import GetSubscriptionUseCase
from app.application.use_cases.list_invoices import (
    GetInvoiceUseCase,
    ListInvoicesUseCase,
)
from app.application.use_cases.list_payment_methods import (
    GetPaymentMethodPortalUrlUseCase,
    ListPaymentMethodsUseCase,
)
from app.application.use_cases.list_plans import ListPlansUseCase
from app.application.use_cases.log_billing_action import LogBillingActionUseCase
from app.application.use_cases.reactivate_subscription import (
    ReactivateSubscriptionUseCase,
)
from app.application.use_cases.send_emails import (
    SendDunningEmailUseCase,
    SendInvoicePaidEmailUseCase,
    SendPaymentFailedEmailUseCase,
    SendTrialExpiringEmailUseCase,
    SendUsageWarningEmailUseCase,
    SendWelcomeEmailUseCase,
)
from app.application.use_cases.start_trial import StartTrialUseCase
from app.application.use_cases.upgrade_subscription import (
    UpgradeSubscriptionUseCase,
)
from app.application.use_cases.usage_increment import (
    IncrementDocsCountUseCase,
    IncrementMinutesUsedUseCase,
    IncrementSessionsCompletedUseCase,
    IncrementSessionsCountUseCase,
)
from app.application.use_cases.validate_promo_code import (
    ValidatePromoCodeUseCase,
)
from app.application.use_cases.webhook_handlers import (
    HandleSubscriptionCanceledWebhookUseCase,
    HandleSubscriptionCreatedWebhookUseCase,
    HandleSubscriptionExpiredWebhookUseCase,
    HandleSubscriptionPaymentFailedWebhookUseCase,
    HandleSubscriptionPaymentRecoveredWebhookUseCase,
    HandleSubscriptionPaymentSuccessWebhookUseCase,
    HandleSubscriptionResumedWebhookUseCase,
    HandleSubscriptionUpdatedWebhookUseCase,
    ProcessWebhookEventUseCase,
)
from app.infrastructure.billing.billing_factory import (
    create_billing_provider,
    is_dev_billing_mode,
)
from app.infrastructure.email.email_factory import (
    create_email_sender,
    create_template_renderer,
)
from app.infrastructure.jobs.scheduler import SusurraScheduler
from app.infrastructure.persistence.sqlite.billing_audit_log_repository import (
    SQLiteBillingAuditLogRepository,
)
from app.infrastructure.persistence.sqlite.invoices_repository import (
    SQLiteInvoicesRepository,
)
from app.infrastructure.persistence.sqlite.payment_methods_repository import (
    SQLitePaymentMethodsRepository,
)
from app.infrastructure.persistence.sqlite.plans_repository import (
    SQLitePlansRepository,
)
from app.infrastructure.persistence.sqlite.promo_codes_repository import (
    SQLitePromoCodesRepository,
)
from app.infrastructure.persistence.sqlite.subscriptions_repository import (
    SQLiteSubscriptionsRepository,
)
from app.infrastructure.persistence.sqlite.usage_repository import (
    SQLiteUsageRepository,
)
from app.infrastructure.persistence.sqlite.webhook_events_repository import (
    SQLiteWebhookEventsRepository,
)


# ---- Repository singletons --------------------------------------------------


@lru_cache(maxsize=1)
def get_plans_repository() -> PlansRepository:
    return SQLitePlansRepository()


@lru_cache(maxsize=1)
def get_subscriptions_repository() -> SubscriptionsRepository:
    return SQLiteSubscriptionsRepository()


@lru_cache(maxsize=1)
def get_payment_methods_repository() -> PaymentMethodsRepository:
    return SQLitePaymentMethodsRepository()


@lru_cache(maxsize=1)
def get_invoices_repository() -> InvoicesRepository:
    return SQLiteInvoicesRepository()


@lru_cache(maxsize=1)
def get_usage_repository() -> UsageRepository:
    return SQLiteUsageRepository()


@lru_cache(maxsize=1)
def get_webhook_events_repository() -> WebhookEventsRepository:
    return SQLiteWebhookEventsRepository()


@lru_cache(maxsize=1)
def get_promo_codes_repository() -> PromoCodesRepository:
    return SQLitePromoCodesRepository()


@lru_cache(maxsize=1)
def get_billing_audit_log_repository() -> BillingAuditLogRepository:
    return SQLiteBillingAuditLogRepository()


# ---- Provider/sender singletons --------------------------------------------


@lru_cache(maxsize=1)
def get_billing_provider() -> BillingProvider:
    return create_billing_provider()


@lru_cache(maxsize=1)
def get_email_sender() -> EmailSender:
    return create_email_sender()


@lru_cache(maxsize=1)
def get_template_renderer():
    """Return the active template renderer callable.

    B5 returned the in-memory ``infrastructure/email/templates.py`` renderer.
    B8 returns the DB-backed renderer (``DBTemplateRendererCallable``) which
    falls back to the in-memory renderer when a template id is missing
    from the DB. Backward compatible with existing
    ``Send*EmailUseCase`` instances — the callable shape is identical.

    NOTE: this factory is called BEFORE the B8 ``get_db_template_renderer``
    function is defined further below, so we instantiate the DB renderer
    inline (not by calling that factory) to avoid forward-reference
    issues during module import."""
    from app.application.use_cases.render_email_template import (
        DBTemplateRendererCallable,
    )
    from app.infrastructure.persistence.sqlite.email_templates_repository import (
        SQLiteEmailTemplatesRepository,
    )

    return DBTemplateRendererCallable(
        repo=SQLiteEmailTemplatesRepository(),
        fallback_renderer=create_template_renderer(),
    )


@lru_cache(maxsize=1)
def get_scheduler() -> SusurraScheduler:
    return SusurraScheduler()


def is_dev_billing() -> bool:
    return is_dev_billing_mode()


# ---- Use case factories ----------------------------------------------------


def get_log_billing_action_use_case(
    audit_repo: BillingAuditLogRepository = Depends(
        get_billing_audit_log_repository
    ),
) -> LogBillingActionUseCase:
    return LogBillingActionUseCase(audit_repo)


def _build_log_billing_action() -> LogBillingActionUseCase:
    return LogBillingActionUseCase(get_billing_audit_log_repository())


def get_list_plans_use_case(
    plans_repo: PlansRepository = Depends(get_plans_repository),
) -> ListPlansUseCase:
    return ListPlansUseCase(plans_repo)


def get_get_subscription_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
) -> GetSubscriptionUseCase:
    return GetSubscriptionUseCase(subs_repo)


def get_start_trial_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    plans_repo: PlansRepository = Depends(get_plans_repository),
    log_billing: LogBillingActionUseCase = Depends(
        get_log_billing_action_use_case
    ),
) -> StartTrialUseCase:
    return StartTrialUseCase(
        subscriptions_repo=subs_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )


def build_start_trial_use_case() -> StartTrialUseCase:
    """Factory usable outside of FastAPI request scope (auth middleware
    calls this on every authenticated request to make trials idempotent)."""
    return StartTrialUseCase(
        subscriptions_repo=get_subscriptions_repository(),
        plans_repo=get_plans_repository(),
        log_billing=_build_log_billing_action(),
    )


def get_create_checkout_session_use_case(
    provider: BillingProvider = Depends(get_billing_provider),
    plans_repo: PlansRepository = Depends(get_plans_repository),
    log_billing: LogBillingActionUseCase = Depends(
        get_log_billing_action_use_case
    ),
) -> CreateCheckoutSessionUseCase:
    return CreateCheckoutSessionUseCase(
        billing_provider=provider,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )


def get_upgrade_subscription_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    plans_repo: PlansRepository = Depends(get_plans_repository),
    provider: BillingProvider = Depends(get_billing_provider),
    log_billing: LogBillingActionUseCase = Depends(
        get_log_billing_action_use_case
    ),
) -> UpgradeSubscriptionUseCase:
    return UpgradeSubscriptionUseCase(
        subscriptions_repo=subs_repo,
        plans_repo=plans_repo,
        billing_provider=provider,
        log_billing=log_billing,
    )


def get_downgrade_subscription_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    plans_repo: PlansRepository = Depends(get_plans_repository),
    log_billing: LogBillingActionUseCase = Depends(
        get_log_billing_action_use_case
    ),
) -> DowngradeSubscriptionUseCase:
    return DowngradeSubscriptionUseCase(
        subscriptions_repo=subs_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )


def get_change_billing_cycle_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    plans_repo: PlansRepository = Depends(get_plans_repository),
    provider: BillingProvider = Depends(get_billing_provider),
    log_billing: LogBillingActionUseCase = Depends(
        get_log_billing_action_use_case
    ),
) -> ChangeBillingCycleUseCase:
    return ChangeBillingCycleUseCase(
        subscriptions_repo=subs_repo,
        plans_repo=plans_repo,
        billing_provider=provider,
        log_billing=log_billing,
    )


def get_cancel_subscription_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    provider: BillingProvider = Depends(get_billing_provider),
    log_billing: LogBillingActionUseCase = Depends(
        get_log_billing_action_use_case
    ),
) -> CancelSubscriptionUseCase:
    return CancelSubscriptionUseCase(
        subscriptions_repo=subs_repo,
        billing_provider=provider,
        log_billing=log_billing,
    )


def get_reactivate_subscription_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    provider: BillingProvider = Depends(get_billing_provider),
    log_billing: LogBillingActionUseCase = Depends(
        get_log_billing_action_use_case
    ),
) -> ReactivateSubscriptionUseCase:
    return ReactivateSubscriptionUseCase(
        subscriptions_repo=subs_repo,
        billing_provider=provider,
        log_billing=log_billing,
    )


def get_list_payment_methods_use_case(
    repo: PaymentMethodsRepository = Depends(get_payment_methods_repository),
) -> ListPaymentMethodsUseCase:
    return ListPaymentMethodsUseCase(repo)


def get_payment_method_portal_url_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    provider: BillingProvider = Depends(get_billing_provider),
) -> GetPaymentMethodPortalUrlUseCase:
    return GetPaymentMethodPortalUrlUseCase(
        subscriptions_repo=subs_repo, billing_provider=provider
    )


def get_list_invoices_use_case(
    repo: InvoicesRepository = Depends(get_invoices_repository),
) -> ListInvoicesUseCase:
    return ListInvoicesUseCase(repo)


def get_get_invoice_use_case(
    repo: InvoicesRepository = Depends(get_invoices_repository),
) -> GetInvoiceUseCase:
    return GetInvoiceUseCase(repo)


def get_get_current_usage_use_case(
    repo: UsageRepository = Depends(get_usage_repository),
) -> GetCurrentUsageUseCase:
    return GetCurrentUsageUseCase(repo)


def get_get_usage_history_use_case(
    repo: UsageRepository = Depends(get_usage_repository),
) -> GetUsageHistoryUseCase:
    return GetUsageHistoryUseCase(repo)


def get_validate_promo_code_use_case(
    repo: PromoCodesRepository = Depends(get_promo_codes_repository),
) -> ValidatePromoCodeUseCase:
    return ValidatePromoCodeUseCase(repo)


def get_check_tier_limits_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    plans_repo: PlansRepository = Depends(get_plans_repository),
    usage_repo: UsageRepository = Depends(get_usage_repository),
) -> CheckTierLimitsUseCase:
    return CheckTierLimitsUseCase(
        subscriptions_repo=subs_repo,
        plans_repo=plans_repo,
        usage_repo=usage_repo,
    )


def get_is_feature_available_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    plans_repo: PlansRepository = Depends(get_plans_repository),
) -> IsFeatureAvailableUseCase:
    return IsFeatureAvailableUseCase(
        subscriptions_repo=subs_repo, plans_repo=plans_repo
    )


# ---- Email use case factories ----------------------------------------------


def _build_send_welcome_email() -> SendWelcomeEmailUseCase:
    return SendWelcomeEmailUseCase(
        sender=get_email_sender(), renderer=get_template_renderer()
    )


def _build_send_trial_expiring_email() -> SendTrialExpiringEmailUseCase:
    return SendTrialExpiringEmailUseCase(
        sender=get_email_sender(), renderer=get_template_renderer()
    )


def _build_send_invoice_paid_email() -> SendInvoicePaidEmailUseCase:
    return SendInvoicePaidEmailUseCase(
        sender=get_email_sender(), renderer=get_template_renderer()
    )


def _build_send_payment_failed_email() -> SendPaymentFailedEmailUseCase:
    return SendPaymentFailedEmailUseCase(
        sender=get_email_sender(), renderer=get_template_renderer()
    )


def _build_send_dunning_email() -> SendDunningEmailUseCase:
    return SendDunningEmailUseCase(
        sender=get_email_sender(), renderer=get_template_renderer()
    )


def _build_send_usage_warning_email() -> SendUsageWarningEmailUseCase:
    return SendUsageWarningEmailUseCase(
        sender=get_email_sender(), renderer=get_template_renderer()
    )


def get_send_welcome_email_use_case() -> SendWelcomeEmailUseCase:
    return _build_send_welcome_email()


# ---- Webhook handler chain --------------------------------------------------


def build_process_webhook_use_case() -> ProcessWebhookEventUseCase:
    """Compose the full webhook handler chain. Used directly by the
    /api/billing/webhook router (no FastAPI Depends for sub-handlers)."""
    subs_repo = get_subscriptions_repository()
    users_repo = get_users_repository()
    plans_repo = get_plans_repository()
    invoices_repo = get_invoices_repository()
    events_repo = get_webhook_events_repository()
    log_billing = _build_log_billing_action()

    on_created = HandleSubscriptionCreatedWebhookUseCase(
        subscriptions_repo=subs_repo,
        users_repo=users_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )
    on_updated = HandleSubscriptionUpdatedWebhookUseCase(
        subscriptions_repo=subs_repo,
        users_repo=users_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )
    on_canceled = HandleSubscriptionCanceledWebhookUseCase(
        subscriptions_repo=subs_repo,
        users_repo=users_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )
    on_resumed = HandleSubscriptionResumedWebhookUseCase(
        subscriptions_repo=subs_repo,
        users_repo=users_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )
    on_payment_success = HandleSubscriptionPaymentSuccessWebhookUseCase(
        subscriptions_repo=subs_repo,
        users_repo=users_repo,
        plans_repo=plans_repo,
        invoices_repo=invoices_repo,
        log_billing=log_billing,
        send_invoice_paid=_build_send_invoice_paid_email(),
    )
    on_payment_failed = HandleSubscriptionPaymentFailedWebhookUseCase(
        subscriptions_repo=subs_repo,
        users_repo=users_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
        send_payment_failed=_build_send_payment_failed_email(),
    )
    on_payment_recovered = HandleSubscriptionPaymentRecoveredWebhookUseCase(
        subscriptions_repo=subs_repo,
        users_repo=users_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )
    on_expired = HandleSubscriptionExpiredWebhookUseCase(
        subscriptions_repo=subs_repo,
        users_repo=users_repo,
        plans_repo=plans_repo,
        log_billing=log_billing,
    )

    return ProcessWebhookEventUseCase(
        billing_provider=get_billing_provider(),
        events_repo=events_repo,
        on_subscription_created=on_created,
        on_subscription_updated=on_updated,
        on_subscription_canceled=on_canceled,
        on_subscription_resumed=on_resumed,
        on_payment_success=on_payment_success,
        on_payment_failed=on_payment_failed,
        on_payment_recovered=on_payment_recovered,
        on_subscription_expired=on_expired,
    )


def get_process_webhook_use_case() -> ProcessWebhookEventUseCase:
    return build_process_webhook_use_case()


# ---- Cron job factories ----------------------------------------------------


def build_check_trial_expiration_use_case() -> CheckTrialExpirationUseCase:
    return CheckTrialExpirationUseCase(
        subscriptions_repo=get_subscriptions_repository(),
        users_repo=get_users_repository(),
        log_billing=_build_log_billing_action(),
    )


def build_reset_monthly_usage_use_case() -> ResetMonthlyUsageUseCase:
    return ResetMonthlyUsageUseCase(get_usage_repository())


def build_send_dunning_email_use_case() -> SendDunningEmailUseCase:
    return _build_send_dunning_email()


def build_send_trial_expiring_email_use_case() -> SendTrialExpiringEmailUseCase:
    return _build_send_trial_expiring_email()


# ---- Usage increment factories (called from B1 EndSession + UploadDocument) ----


def build_increment_minutes_use_case() -> IncrementMinutesUsedUseCase:
    return IncrementMinutesUsedUseCase(get_usage_repository())


def build_increment_sessions_count_use_case() -> IncrementSessionsCountUseCase:
    return IncrementSessionsCountUseCase(get_usage_repository())


def build_increment_sessions_completed_use_case() -> IncrementSessionsCompletedUseCase:
    return IncrementSessionsCompletedUseCase(get_usage_repository())


def build_increment_docs_count_use_case() -> IncrementDocsCountUseCase:
    return IncrementDocsCountUseCase(get_usage_repository())


# ---------------------------------------------------------------------------
# B6 — Recordings (Pro+) composition root
# ---------------------------------------------------------------------------


from app.application.ports.audio_storage import AudioStorage
from app.application.ports.recordings_repository import RecordingsRepository
from app.application.use_cases.check_tier_limits import (
    IsRecordingsAvailableUseCase,
)
from app.application.use_cases.cleanup_expired_recordings import (
    CleanupExpiredRecordingsUseCase,
)
from app.application.use_cases.delete_recording import DeleteRecordingUseCase
from app.application.use_cases.get_recording_url import GetRecordingUrlUseCase
from app.application.use_cases.list_recordings import ListRecordingsUseCase
from app.application.use_cases.upload_recording import UploadRecordingUseCase
from app.infrastructure.persistence.sqlite.recordings_repository import (
    SQLiteRecordingsRepository,
)
from app.infrastructure.storage.storage_factory import create_audio_storage


@lru_cache(maxsize=1)
def get_recordings_repository() -> RecordingsRepository:
    return SQLiteRecordingsRepository()


@lru_cache(maxsize=1)
def get_audio_storage() -> AudioStorage:
    return create_audio_storage()


def get_is_recordings_available_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    plans_repo: PlansRepository = Depends(get_plans_repository),
) -> IsRecordingsAvailableUseCase:
    return IsRecordingsAvailableUseCase(
        subscriptions_repo=subs_repo, plans_repo=plans_repo
    )


def get_upload_recording_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    recordings_repo: RecordingsRepository = Depends(get_recordings_repository),
    storage: AudioStorage = Depends(get_audio_storage),
    prefs_repo: UserPreferencesRepository = Depends(
        get_user_preferences_repository
    ),
    is_available: IsRecordingsAvailableUseCase = Depends(
        get_is_recordings_available_use_case
    ),
) -> UploadRecordingUseCase:
    return UploadRecordingUseCase(
        sessions_repo=sessions_repo,
        recordings_repo=recordings_repo,
        storage=storage,
        prefs_repo=prefs_repo,
        is_available=is_available,
    )


def get_get_recording_url_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    recordings_repo: RecordingsRepository = Depends(get_recordings_repository),
    storage: AudioStorage = Depends(get_audio_storage),
) -> GetRecordingUrlUseCase:
    return GetRecordingUrlUseCase(
        sessions_repo=sessions_repo,
        recordings_repo=recordings_repo,
        storage=storage,
    )


def get_delete_recording_use_case(
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    recordings_repo: RecordingsRepository = Depends(get_recordings_repository),
    storage: AudioStorage = Depends(get_audio_storage),
) -> DeleteRecordingUseCase:
    return DeleteRecordingUseCase(
        sessions_repo=sessions_repo,
        recordings_repo=recordings_repo,
        storage=storage,
    )


def get_list_recordings_use_case(
    repo: RecordingsRepository = Depends(get_recordings_repository),
) -> ListRecordingsUseCase:
    return ListRecordingsUseCase(repo)


def build_cleanup_expired_recordings_use_case() -> CleanupExpiredRecordingsUseCase:
    """Cron-scope factory (no Depends context). Used by main.py lifespan
    + the admin manual-trigger endpoint."""
    return CleanupExpiredRecordingsUseCase(
        recordings_repo=get_recordings_repository(),
        storage=get_audio_storage(),
    )


def build_cleanup_abandoned_sessions_use_case(
    *, timeout_minutes: int | None = None
) -> "CleanupAbandonedSessionsUseCase":
    """Cron-scope factory for the abandoned-sessions sweeper.

    Used by ``main.py`` lifespan (registering the APScheduler job) and
    by the admin manual-trigger endpoint. Pass ``timeout_minutes`` to
    override the use case's built-in 5-minute default — the admin
    endpoint forwards a query-param override when present, the
    APScheduler wrapper uses the default.
    """
    # Local import to avoid blowing the top-of-file import block; this
    # use case is wired only from cron + admin paths.
    from app.application.use_cases.cleanup_abandoned_sessions import (
        CleanupAbandonedSessionsUseCase,
    )

    kwargs: dict[str, object] = {
        "sessions_repo": get_sessions_repository(),
        "transcripts_repo": get_transcripts_repository(),
    }
    if timeout_minutes is not None:
        kwargs["timeout_minutes"] = timeout_minutes
    return CleanupAbandonedSessionsUseCase(**kwargs)  # type: ignore[arg-type]


# ---------------------------------------------------------------------------
# B7 — Share Links (Premium) composition root
# ---------------------------------------------------------------------------


from app.application.ports.share_links_repository import ShareLinksRepository
from app.application.use_cases.check_tier_limits import (
    IsShareLinksAvailableUseCase,
)
from app.application.use_cases.create_share_link import (
    CreateShareLinkUseCase,
)
from app.application.use_cases.get_shared_session_public import (
    GetSharedSessionPublicUseCase,
)
from app.application.use_cases.list_share_links_for_session import (
    ListShareLinksForSessionUseCase,
)
from app.application.use_cases.revoke_share_link import (
    RevokeShareLinkUseCase,
)
from app.infrastructure.persistence.sqlite.share_links_repository import (
    SQLiteShareLinksRepository,
)


@lru_cache(maxsize=1)
def get_share_links_repository() -> ShareLinksRepository:
    return SQLiteShareLinksRepository()


def get_is_share_links_available_use_case(
    subs_repo: SubscriptionsRepository = Depends(get_subscriptions_repository),
    plans_repo: PlansRepository = Depends(get_plans_repository),
) -> IsShareLinksAvailableUseCase:
    return IsShareLinksAvailableUseCase(
        subscriptions_repo=subs_repo, plans_repo=plans_repo
    )


def get_create_share_link_use_case(
    share_repo: ShareLinksRepository = Depends(get_share_links_repository),
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    is_available: IsShareLinksAvailableUseCase = Depends(
        get_is_share_links_available_use_case
    ),
    check_tier_limits: CheckTierLimitsUseCase = Depends(
        get_check_tier_limits_use_case
    ),
    usage_repo: UsageRepository = Depends(get_usage_repository),
) -> CreateShareLinkUseCase:
    return CreateShareLinkUseCase(
        share_repo=share_repo,
        sessions_repo=sessions_repo,
        is_share_available=is_available,
        check_tier_limits=check_tier_limits,
        usage_repo=usage_repo,
    )


def get_revoke_share_link_use_case(
    share_repo: ShareLinksRepository = Depends(get_share_links_repository),
) -> RevokeShareLinkUseCase:
    return RevokeShareLinkUseCase(share_repo=share_repo)


def get_list_share_links_for_session_use_case(
    share_repo: ShareLinksRepository = Depends(get_share_links_repository),
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
) -> ListShareLinksForSessionUseCase:
    return ListShareLinksForSessionUseCase(
        share_repo=share_repo, sessions_repo=sessions_repo
    )


def get_shared_session_public_use_case(
    share_repo: ShareLinksRepository = Depends(get_share_links_repository),
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
    transcripts_repo: TranscriptsRepository = Depends(
        get_transcripts_repository
    ),
    hints_repo: HintsRepository = Depends(get_hints_repository),
    speakers_repo: SpeakersRepository = Depends(get_speakers_repository),
    recordings_repo: RecordingsRepository = Depends(
        get_recordings_repository
    ),
    storage: AudioStorage = Depends(get_audio_storage),
) -> GetSharedSessionPublicUseCase:
    return GetSharedSessionPublicUseCase(
        share_repo=share_repo,
        sessions_repo=sessions_repo,
        transcripts_repo=transcripts_repo,
        hints_repo=hints_repo,
        speakers_repo=speakers_repo,
        recordings_repo=recordings_repo,
        storage=storage,
    )


# ---------------------------------------------------------------------------
# B8 — Cross-cutting composition root (notifications, api keys, jobs, health,
# rate limit, circuit breaker, security)
# ---------------------------------------------------------------------------


from app.application.ports.api_key_encryptor import APIKeyEncryptor
from app.application.ports.api_keys_repository import APIKeysRepository
from app.application.ports.background_jobs_repository import (
    BackgroundJobsRepository,
)
from app.application.ports.circuit_breaker import CircuitBreaker
from app.application.ports.email_templates_repository import (
    EmailTemplatesRepository,
)
from app.application.ports.health_check import HealthProbe
from app.application.ports.notifications_repository import (
    NotificationsRepository,
)
from app.application.ports.rate_limiter import RateLimiter
from app.application.use_cases.create_notification import (
    CreateNotificationUseCase,
)
from app.application.use_cases.get_email_template import (
    GetEmailTemplateUseCase,
)
from app.application.use_cases.get_health_status import (
    GetHealthStatusUseCase,
)
from app.application.use_cases.list_notifications import (
    CountUnreadNotificationsUseCase,
    ListNotificationsUseCase,
)
from app.application.use_cases.manage_api_keys import (
    AddAPIKeyUseCase,
    DeleteAPIKeyUseCase,
    GetActiveAPIKeyForProviderUseCase,
    ListAPIKeysUseCase,
)
from app.application.use_cases.manage_background_jobs import (
    CreateBackgroundJobUseCase,
    ListBackgroundJobsUseCase,
    MarkJobCompletedUseCase,
    MarkJobFailedUseCase,
    MarkJobRunningUseCase,
)
from app.application.use_cases.mark_notification_read import (
    MarkAllNotificationsReadUseCase,
    MarkNotificationReadUseCase,
)
from app.application.use_cases.render_email_template import (
    DBTemplateRendererCallable,
    RenderEmailTemplateUseCase,
)
from app.infrastructure.circuit_breaker.in_memory_breaker import (
    create_circuit_breaker,
)
from app.infrastructure.health.probes import (
    DBHealthProbe,
    LLMHealthProbe,
    StorageHealthProbe,
)
from app.infrastructure.persistence.sqlite.api_keys_repository import (
    SQLiteAPIKeysRepository,
)
from app.infrastructure.persistence.sqlite.background_jobs_repository import (
    SQLiteBackgroundJobsRepository,
)
from app.infrastructure.persistence.sqlite.email_templates_repository import (
    SQLiteEmailTemplatesRepository,
)
from app.infrastructure.persistence.sqlite.notifications_repository import (
    SQLiteNotificationsRepository,
)
from app.infrastructure.rate_limit.in_memory_rate_limiter import (
    create_rate_limiter,
)
from app.infrastructure.security.api_key_encryptor import create_encryptor


# ---- Repository singletons --------------------------------------------------


@lru_cache(maxsize=1)
def get_notifications_repository() -> NotificationsRepository:
    return SQLiteNotificationsRepository()


@lru_cache(maxsize=1)
def get_email_templates_repository() -> EmailTemplatesRepository:
    return SQLiteEmailTemplatesRepository()


@lru_cache(maxsize=1)
def get_background_jobs_repository() -> BackgroundJobsRepository:
    return SQLiteBackgroundJobsRepository()


@lru_cache(maxsize=1)
def get_api_keys_repository() -> APIKeysRepository:
    return SQLiteAPIKeysRepository()


# ---- Cross-cutting service singletons --------------------------------------


@lru_cache(maxsize=1)
def get_api_key_encryptor() -> APIKeyEncryptor:
    return create_encryptor()


@lru_cache(maxsize=1)
def get_rate_limiter() -> RateLimiter:
    return create_rate_limiter()


@lru_cache(maxsize=1)
def get_circuit_breaker() -> CircuitBreaker:
    return create_circuit_breaker()


@lru_cache(maxsize=1)
def get_db_template_renderer() -> DBTemplateRendererCallable:
    """DB-backed template renderer with the legacy hardcoded renderer
    as a safety-net fallback. Replaces the B5 ``create_template_renderer``
    callable consumed by ``Send*EmailUseCase``. Same callable shape so
    no use-case changes are required."""
    from app.infrastructure.email.email_factory import (
        create_template_renderer as legacy_renderer_factory,
    )

    return DBTemplateRendererCallable(
        repo=get_email_templates_repository(),
        fallback_renderer=legacy_renderer_factory(),
    )


# ---- Health probe assembly --------------------------------------------------


@lru_cache(maxsize=1)
def get_health_probes() -> list[HealthProbe]:
    return [
        DBHealthProbe(),
        LLMHealthProbe(
            llm=get_llm_provider(), breaker=get_circuit_breaker()
        ),
        StorageHealthProbe(),
    ]


@lru_cache(maxsize=1)
def get_health_status_use_case() -> GetHealthStatusUseCase:
    return GetHealthStatusUseCase(get_health_probes())


# ---- Notification use case factories ---------------------------------------


def get_create_notification_use_case(
    repo: NotificationsRepository = Depends(get_notifications_repository),
) -> CreateNotificationUseCase:
    return CreateNotificationUseCase(repo)


def get_list_notifications_use_case(
    repo: NotificationsRepository = Depends(get_notifications_repository),
) -> ListNotificationsUseCase:
    return ListNotificationsUseCase(repo)


def get_count_unread_notifications_use_case(
    repo: NotificationsRepository = Depends(get_notifications_repository),
) -> CountUnreadNotificationsUseCase:
    return CountUnreadNotificationsUseCase(repo)


def get_mark_notification_read_use_case(
    repo: NotificationsRepository = Depends(get_notifications_repository),
) -> MarkNotificationReadUseCase:
    return MarkNotificationReadUseCase(repo)


def get_mark_all_notifications_read_use_case(
    repo: NotificationsRepository = Depends(get_notifications_repository),
) -> MarkAllNotificationsReadUseCase:
    return MarkAllNotificationsReadUseCase(repo)


# ---- Email template use case factories -------------------------------------


def get_get_email_template_use_case(
    repo: EmailTemplatesRepository = Depends(get_email_templates_repository),
) -> GetEmailTemplateUseCase:
    return GetEmailTemplateUseCase(repo)


def get_render_email_template_use_case(
    repo: EmailTemplatesRepository = Depends(get_email_templates_repository),
) -> RenderEmailTemplateUseCase:
    return RenderEmailTemplateUseCase(repo)


# ---- Background-job use case factories -------------------------------------


def get_create_background_job_use_case(
    repo: BackgroundJobsRepository = Depends(get_background_jobs_repository),
) -> CreateBackgroundJobUseCase:
    return CreateBackgroundJobUseCase(repo)


def get_list_background_jobs_use_case(
    repo: BackgroundJobsRepository = Depends(get_background_jobs_repository),
) -> ListBackgroundJobsUseCase:
    return ListBackgroundJobsUseCase(repo)


def get_mark_job_running_use_case(
    repo: BackgroundJobsRepository = Depends(get_background_jobs_repository),
) -> MarkJobRunningUseCase:
    return MarkJobRunningUseCase(repo)


def get_mark_job_completed_use_case(
    repo: BackgroundJobsRepository = Depends(get_background_jobs_repository),
) -> MarkJobCompletedUseCase:
    return MarkJobCompletedUseCase(repo)


def get_mark_job_failed_use_case(
    repo: BackgroundJobsRepository = Depends(get_background_jobs_repository),
) -> MarkJobFailedUseCase:
    return MarkJobFailedUseCase(repo)


# ---- API-key (BYOK) use case factories -------------------------------------


def get_add_api_key_use_case(
    repo: APIKeysRepository = Depends(get_api_keys_repository),
    encryptor: APIKeyEncryptor = Depends(get_api_key_encryptor),
) -> AddAPIKeyUseCase:
    return AddAPIKeyUseCase(repo=repo, encryptor=encryptor)


def get_list_api_keys_use_case(
    repo: APIKeysRepository = Depends(get_api_keys_repository),
) -> ListAPIKeysUseCase:
    return ListAPIKeysUseCase(repo)


def get_delete_api_key_use_case(
    repo: APIKeysRepository = Depends(get_api_keys_repository),
) -> DeleteAPIKeyUseCase:
    return DeleteAPIKeyUseCase(repo)


def get_get_active_api_key_for_provider_use_case(
    repo: APIKeysRepository = Depends(get_api_keys_repository),
    encryptor: APIKeyEncryptor = Depends(get_api_key_encryptor),
) -> GetActiveAPIKeyForProviderUseCase:
    return GetActiveAPIKeyForProviderUseCase(
        repo=repo, encryptor=encryptor
    )


def build_get_active_api_key_for_provider_use_case() -> (
    GetActiveAPIKeyForProviderUseCase
):
    """Out-of-request-scope factory for LLM/STT factories that need the
    BYOK plaintext when assembling provider clients."""
    return GetActiveAPIKeyForProviderUseCase(
        repo=get_api_keys_repository(),
        encryptor=get_api_key_encryptor(),
    )


# ---------------------------------------------------------------------------
# H1 — Personas + session materials repos & use cases
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_personas_repository() -> PersonasRepository:
    return SQLitePersonasRepository()


@lru_cache(maxsize=1)
def get_session_materials_repository() -> SessionMaterialsRepository:
    return SQLiteSessionMaterialsRepository()


def get_create_persona_use_case(
    repo: PersonasRepository = Depends(get_personas_repository),
) -> CreatePersonaUseCase:
    return CreatePersonaUseCase(repo)


def get_list_personas_use_case(
    repo: PersonasRepository = Depends(get_personas_repository),
) -> ListPersonasUseCase:
    return ListPersonasUseCase(repo)


def get_get_persona_use_case(
    repo: PersonasRepository = Depends(get_personas_repository),
) -> GetPersonaUseCase:
    return GetPersonaUseCase(repo)


def get_update_persona_use_case(
    repo: PersonasRepository = Depends(get_personas_repository),
) -> UpdatePersonaUseCase:
    return UpdatePersonaUseCase(repo)


def get_delete_persona_use_case(
    repo: PersonasRepository = Depends(get_personas_repository),
) -> DeletePersonaUseCase:
    return DeletePersonaUseCase(repo)


def get_set_default_persona_use_case(
    repo: PersonasRepository = Depends(get_personas_repository),
) -> SetDefaultPersonaUseCase:
    return SetDefaultPersonaUseCase(repo)


def get_link_persona_document_use_case(
    repo: PersonasRepository = Depends(get_personas_repository),
) -> LinkPersonaDocumentUseCase:
    return LinkPersonaDocumentUseCase(repo)


def get_unlink_persona_document_use_case(
    repo: PersonasRepository = Depends(get_personas_repository),
) -> UnlinkPersonaDocumentUseCase:
    return UnlinkPersonaDocumentUseCase(repo)


def get_create_session_material_use_case(
    materials_repo: SessionMaterialsRepository = Depends(
        get_session_materials_repository
    ),
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
) -> CreateSessionMaterialUseCase:
    return CreateSessionMaterialUseCase(
        materials_repo=materials_repo, sessions_repo=sessions_repo
    )


def get_list_session_materials_use_case(
    materials_repo: SessionMaterialsRepository = Depends(
        get_session_materials_repository
    ),
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
) -> ListSessionMaterialsUseCase:
    return ListSessionMaterialsUseCase(
        materials_repo=materials_repo, sessions_repo=sessions_repo
    )


def get_delete_session_material_use_case(
    materials_repo: SessionMaterialsRepository = Depends(
        get_session_materials_repository
    ),
    sessions_repo: SessionsRepository = Depends(get_sessions_repository),
) -> DeleteSessionMaterialUseCase:
    return DeleteSessionMaterialUseCase(
        materials_repo=materials_repo, sessions_repo=sessions_repo
    )


# ---------------------------------------------------------------------------
# Meeting Frame foundation — OAuth credential storage
# ---------------------------------------------------------------------------


from app.application.ports.oauth_token_storage import OAuthTokenStorage
from app.infrastructure.persistence.sqlite.db import DB_PATH
from app.infrastructure.persistence.sqlite.oauth_repository import (
    SqliteOAuthRepository,
)


def _resolve_fernet_key() -> bytes:
    """Resolve the Fernet key for OAuth-token encryption at rest.

    Production REQUIRES ``FERNET_KEY`` (url-safe base64, 32 raw bytes).
    Dev mode (``is_dev_mode()``) falls back to a generated key + warning so
    the container boots without operator setup; that key MUST NEVER be used
    in production (rows encrypted with it become unreadable on next boot)."""
    import logging

    from cryptography.fernet import Fernet

    logger = logging.getLogger(__name__)

    raw = os.getenv("FERNET_KEY", "").strip()
    if raw:
        return raw.encode("ascii")

    if is_dev_mode():
        logger.warning(
            "[OAuth] FERNET_KEY not set — generating an ephemeral DEV key. "
            "DO NOT USE IN PRODUCTION (existing rows will become unreadable "
            "on next boot)."
        )
        return Fernet.generate_key()

    raise RuntimeError(
        "FERNET_KEY env var is required in production "
        "(url-safe base64-encoded 32 bytes). Generate one with: "
        'python -c "from cryptography.fernet import Fernet; '
        'print(Fernet.generate_key().decode())"'
    )


@lru_cache(maxsize=1)
def get_oauth_repository() -> OAuthTokenStorage:
    return SqliteOAuthRepository(
        db_path=str(DB_PATH), fernet_key=_resolve_fernet_key()
    )


# ---------------------------------------------------------------------------
# Meeting Frame — Google OAuth client (Sprint 1)
# ---------------------------------------------------------------------------


def get_google_oauth_client() -> "GoogleOAuthClient":  # noqa: F821
    """Build a Google OAuth client from settings, raising 503 if unconfigured.

    Not cached: it's a tiny stateless object and the credentials may rotate
    via env reload in dev. Production callers can wrap with ``lru_cache`` if
    they need the singleton."""
    from fastapi import HTTPException, status as _status

    from app.infrastructure.config.settings import get_settings
    from app.infrastructure.oauth.google_oauth_client import GoogleOAuthClient

    settings = get_settings()
    if not settings.google_client_id or not settings.google_client_secret:
        raise HTTPException(
            status_code=_status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google OAuth not configured",
        )
    return GoogleOAuthClient(
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
        redirect_uri=settings.google_redirect_uri,
    )


# ---------------------------------------------------------------------------
# Meeting Frame — Meetings repository + Google Meet client + MeetProvider
# ---------------------------------------------------------------------------


@lru_cache(maxsize=1)
def get_meetings_repository() -> "MeetingsRepository":  # noqa: F821
    """SQLite-backed meetings repository (singleton — cheap to share)."""
    from app.application.ports.meetings_repository import MeetingsRepository  # noqa: F401
    from app.infrastructure.persistence.sqlite.meetings_repository import (
        SqliteMeetingsRepository,
    )

    return SqliteMeetingsRepository(db_path=str(DB_PATH))


def get_google_meet_client() -> "GoogleMeetClient":  # noqa: F821
    """Stateless Meet REST API client. Constructed per request."""
    from app.infrastructure.meet.google_meet_client import GoogleMeetClient

    return GoogleMeetClient()


def get_meet_provider(
    oauth_repo: "OAuthTokenStorage" = Depends(get_oauth_repository),  # noqa: F821
    meetings_repo: "MeetingsRepository" = Depends(get_meetings_repository),  # noqa: F821
    google_oauth_client: "GoogleOAuthClient" = Depends(get_google_oauth_client),  # noqa: F821
    google_meet_client: "GoogleMeetClient" = Depends(get_google_meet_client),  # noqa: F821
) -> "MeetProvider":  # noqa: F821
    """Wire the MeetProvider for the request scope.

    Per-request construction is fine — all dependencies are either singletons
    (oauth_repo, meetings_repo) or stateless objects (oauth/meet clients)."""
    from app.application.services.meet_provider import MeetProvider

    return MeetProvider(
        oauth_repo=oauth_repo,
        meetings_repo=meetings_repo,
        google_oauth_client=google_oauth_client,
        google_meet_client=google_meet_client,
    )
