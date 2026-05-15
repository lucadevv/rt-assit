"use client";

/**
 * Composition root — the ONLY place the application allows a presentation
 * component to reach into infrastructure. Every concrete adapter is
 * instantiated here and wired into use cases.
 *
 * Why a hook (not a module singleton):
 *   - The auth adapter is a hook itself (it consumes Clerk hooks or returns
 *     the dev user). We need its return value during render to extract
 *     `getToken`, which the ApiClient uses for every request.
 *   - `useMemo` keyed on the auth instance keeps the container stable
 *     between renders unless auth state actually changes — preventing
 *     unnecessary re-instantiation of use cases.
 *
 * F2 additions:
 *   - audioCapture (singleton — getDisplayMedia is global, one capture at a time)
 *   - audioUplinkFactory(sessionId, userId) — per-session WS to rt_go
 *   - transcriptsStream (singleton — overlay broadcaster, one URL)
 *   - agentStreamFactory(sessionId) — per-session backend WS
 *   - sessionsApi / speakersApi REST adapters
 *   - F2 use cases (create / end / recover / detail + speakers)
 *
 * Layer rule reminder: this file is the ONLY consumer of `infrastructure/*`
 * outside of itself. Components/hooks must consume the container, not
 * import adapters directly.
 */

import { useMemo } from "react";
import { useAuthAdapter } from "@/infrastructure/auth/auth-factory";
import { FetchApiClient } from "@/infrastructure/http/api-client";
import { SessionsApiAdapter } from "@/infrastructure/http/sessions-api-adapter";
import { SpeakersApiAdapter } from "@/infrastructure/http/speakers-api-adapter";
import { DocumentsApiAdapter } from "@/infrastructure/http/documents-api-adapter";
import { PersonasApiAdapter } from "@/infrastructure/http/personas-api-adapter";
import { SessionMaterialsApiAdapter } from "@/infrastructure/http/session-materials-api-adapter";
import { PreferencesApiAdapter } from "@/infrastructure/http/preferences-api-adapter";
import { IntegrationsApiAdapter } from "@/infrastructure/http/integrations-api-adapter";
import { UsersApiAdapter } from "@/infrastructure/http/users-api-adapter";
import { TabShareAudioStrategy } from "@/infrastructure/meeting/audio-strategies/tab-share-audio.strategy";
import { AudioUplinkWS } from "@/infrastructure/ws/audio-uplink-ws";
import { TranscriptsStreamWS } from "@/infrastructure/ws/transcripts-stream-ws";
import { AgentStreamWS } from "@/infrastructure/ws/agent-stream-ws";
import { GetCurrentUserUseCase } from "@/application/use-cases/get-current-user";
import { ListScenariosUseCase } from "@/application/use-cases/list-scenarios";
import { CreateSessionUseCase } from "@/application/use-cases/create-session";
import { GetSessionDetailUseCase } from "@/application/use-cases/get-session-detail";
import { RecoverActiveSessionUseCase } from "@/application/use-cases/recover-active-session";
import { EndSessionUseCase } from "@/application/use-cases/end-session";
import { ListSpeakersUseCase } from "@/application/use-cases/list-speakers";
import { RenameSpeakerUseCase } from "@/application/use-cases/rename-speaker";
import { ListDocumentsUseCase } from "@/application/use-cases/list-documents";
import { GetDocumentUseCase } from "@/application/use-cases/get-document";
import { UploadFileDocumentUseCase } from "@/application/use-cases/upload-file-document";
import { UploadUrlDocumentUseCase } from "@/application/use-cases/upload-url-document";
import { UploadTextDocumentUseCase } from "@/application/use-cases/upload-text-document";
import { UpdateDocumentUseCase } from "@/application/use-cases/update-document";
import { DeleteDocumentUseCase } from "@/application/use-cases/delete-document";
import { HasCvUploadedUseCase } from "@/application/use-cases/has-cv-uploaded";
import { ListPersonasUseCase } from "@/application/use-cases/list-personas";
import { CreatePersonaUseCase } from "@/application/use-cases/create-persona";
import { GetPersonaUseCase } from "@/application/use-cases/get-persona";
import { UpdatePersonaUseCase } from "@/application/use-cases/update-persona";
import { DeletePersonaUseCase } from "@/application/use-cases/delete-persona";
import { SetDefaultPersonaUseCase } from "@/application/use-cases/set-default-persona";
import { LinkPersonaDocumentUseCase } from "@/application/use-cases/link-persona-document";
import { UnlinkPersonaDocumentUseCase } from "@/application/use-cases/unlink-persona-document";
import { ListSessionMaterialsUseCase } from "@/application/use-cases/list-session-materials";
import { CreateSessionMaterialUseCase } from "@/application/use-cases/create-session-material";
import { DeleteSessionMaterialUseCase } from "@/application/use-cases/delete-session-material";
import { GetDashboardStatsUseCase } from "@/application/use-cases/get-dashboard-stats";
import { ListRecentSessionsUseCase } from "@/application/use-cases/list-recent-sessions";
import { ListSessionsUseCase } from "@/application/use-cases/list-sessions";
import { DeleteSessionUseCase } from "@/application/use-cases/delete-session";
import { DocumentPipAdapter } from "@/infrastructure/pip/document-pip-adapter";
import { TogglePipOverlayUseCase } from "@/application/use-cases/toggle-pip-overlay";
import { GetPreferencesUseCase } from "@/application/use-cases/get-preferences";
import { UpdatePreferencesUseCase } from "@/application/use-cases/update-preferences";
import { UpdateUserProfileUseCase } from "@/application/use-cases/update-user-profile";
import { DeleteUserDataUseCase } from "@/application/use-cases/delete-user-data";
import { ListIntegrationsUseCase } from "@/application/use-cases/list-integrations";
import { BillingApiAdapter } from "@/infrastructure/http/billing-api-adapter";
import { ListPlansUseCase } from "@/application/use-cases/list-plans";
import { GetSubscriptionUseCase } from "@/application/use-cases/get-subscription";
import { CreateCheckoutUseCase } from "@/application/use-cases/create-checkout";
import { CancelSubscriptionUseCase } from "@/application/use-cases/cancel-subscription";
import { ReactivateSubscriptionUseCase } from "@/application/use-cases/reactivate-subscription";
import { UpgradeSubscriptionUseCase } from "@/application/use-cases/upgrade-subscription";
import { DowngradeSubscriptionUseCase } from "@/application/use-cases/downgrade-subscription";
import { ListPaymentMethodsUseCase } from "@/application/use-cases/list-payment-methods";
import { GetPortalUrlUseCase } from "@/application/use-cases/get-portal-url";
import { ListInvoicesUseCase } from "@/application/use-cases/list-invoices";
import { GetCurrentUsageUseCase } from "@/application/use-cases/get-current-usage";
import { ValidatePromoUseCase } from "@/application/use-cases/validate-promo";
import { CheckFeatureAvailabilityUseCase } from "@/application/use-cases/check-feature-availability";
import { RecordingsApiAdapter } from "@/infrastructure/http/recordings-api-adapter";
import { ShareApiAdapter } from "@/infrastructure/http/share-api-adapter";
import { ListRecordingsUseCase } from "@/application/use-cases/list-recordings";
import { GetRecordingPlaybackUseCase } from "@/application/use-cases/get-recording-playback";
import { DeleteRecordingUseCase } from "@/application/use-cases/delete-recording";
import { RegenerateSessionSummaryUseCase } from "@/application/use-cases/regenerate-session-summary";
import { CreateShareLinkUseCase } from "@/application/use-cases/create-share-link";
import { ListSessionShareLinksUseCase } from "@/application/use-cases/list-session-share-links";
import { RevokeShareLinkUseCase } from "@/application/use-cases/revoke-share-link";
import { createAnalytics } from "@/infrastructure/analytics/analytics-factory";
import { TrackAnalyticsEventUseCase } from "@/application/use-cases/track-analytics-event";
import type { AnalyticsPort } from "@/application/ports/analytics.port";
import type { RecordingsApiPort } from "@/application/ports/recordings-api.port";
import type { ShareApiPort } from "@/application/ports/share-api.port";
import type { PreferencesApiPort } from "@/application/ports/preferences-api.port";
import type { IntegrationsApiPort } from "@/application/ports/integrations-api.port";
import type { UsersApiPort } from "@/application/ports/users-api.port";
import type { BillingApiPort } from "@/application/ports/billing-api.port";
import type { PipOverlayPort } from "@/application/ports/pip-overlay.port";
import type { AuthPort } from "@/application/ports/auth.port";
import type { ApiClient } from "@/application/ports/api-client.port";
import type { AudioCaptureStrategy } from "@/application/ports/audio-capture-strategy.port";
import type { AudioUplinkPort } from "@/application/ports/audio-uplink.port";
import type { TranscriptsStreamPort } from "@/application/ports/transcripts-stream.port";
import type { AgentStreamPort } from "@/application/ports/agent-stream.port";
import type { SessionsApiPort } from "@/application/ports/sessions-api.port";
import type { SpeakersApiPort } from "@/application/ports/speakers-api.port";
import type { DocumentsApiPort } from "@/application/ports/documents-api.port";
import type { PersonasApiPort } from "@/application/ports/personas-api.port";
import type { SessionMaterialsApiPort } from "@/application/ports/session-materials-api.port";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8767";
const AUDIO_WS_URL =
  process.env.NEXT_PUBLIC_AUDIO_WS_URL ?? "ws://localhost:8766/audio";
const TRANSCRIPTS_WS_URL =
  process.env.NEXT_PUBLIC_TRANSCRIPTS_WS_URL ?? "ws://localhost:8765/ws";
const AGENT_WS_URL =
  process.env.NEXT_PUBLIC_AGENT_WS_URL ?? "ws://localhost:8767/ws/web";

export interface SusurraContainer {
  auth: AuthPort;
  apiClient: ApiClient;

  // F1
  getCurrentUser: GetCurrentUserUseCase;
  listScenarios: ListScenariosUseCase;

  // F2 — infra (singletons within container lifetime)
  audioCapture: AudioCaptureStrategy;
  transcriptsStream: TranscriptsStreamPort;
  audioUplinkFactory: (sessionId: string, userId: string) => AudioUplinkPort;
  agentStreamFactory: (sessionId: string) => AgentStreamPort;

  // F2 — REST ports
  sessionsApi: SessionsApiPort;
  speakersApi: SpeakersApiPort;

  // F2 — use cases
  createSession: CreateSessionUseCase;
  getSessionDetail: GetSessionDetailUseCase;
  recoverActiveSession: RecoverActiveSessionUseCase;
  endSession: EndSessionUseCase;
  listSpeakers: ListSpeakersUseCase;
  renameSpeaker: RenameSpeakerUseCase;

  // F3 — Knowledge Base
  documentsApi: DocumentsApiPort;
  listDocuments: ListDocumentsUseCase;
  getDocument: GetDocumentUseCase;
  uploadFileDocument: UploadFileDocumentUseCase;
  uploadUrlDocument: UploadUrlDocumentUseCase;
  uploadTextDocument: UploadTextDocumentUseCase;
  updateDocument: UpdateDocumentUseCase;
  deleteDocument: DeleteDocumentUseCase;
  hasCvUploaded: HasCvUploadedUseCase;

  // H3 — Personas + Session Materials
  personasApi: PersonasApiPort;
  sessionMaterialsApi: SessionMaterialsApiPort;
  listPersonas: ListPersonasUseCase;
  createPersona: CreatePersonaUseCase;
  getPersona: GetPersonaUseCase;
  updatePersona: UpdatePersonaUseCase;
  deletePersona: DeletePersonaUseCase;
  setDefaultPersona: SetDefaultPersonaUseCase;
  linkPersonaDocument: LinkPersonaDocumentUseCase;
  unlinkPersonaDocument: UnlinkPersonaDocumentUseCase;
  listSessionMaterials: ListSessionMaterialsUseCase;
  createSessionMaterial: CreateSessionMaterialUseCase;
  deleteSessionMaterial: DeleteSessionMaterialUseCase;

  // F4 — Home Dashboard (computed views over sessions)
  getDashboardStats: GetDashboardStatsUseCase;
  listRecentSessions: ListRecentSessionsUseCase;

  // F10 — Sessions list + detail
  listSessions: ListSessionsUseCase;
  deleteSession: DeleteSessionUseCase;

  // F5 — PiP Overlay
  pipOverlay: PipOverlayPort;
  togglePipOverlay: TogglePipOverlayUseCase;

  // F6 — Settings
  preferencesApi: PreferencesApiPort;
  integrationsApi: IntegrationsApiPort;
  usersApi: UsersApiPort;
  getPreferences: GetPreferencesUseCase;
  updatePreferences: UpdatePreferencesUseCase;
  updateUserProfile: UpdateUserProfileUseCase;
  deleteUserData: DeleteUserDataUseCase;
  listIntegrations: ListIntegrationsUseCase;

  // F7 — Billing
  billingApi: BillingApiPort;
  listPlans: ListPlansUseCase;
  getSubscription: GetSubscriptionUseCase;
  createCheckout: CreateCheckoutUseCase;
  cancelSubscription: CancelSubscriptionUseCase;
  reactivateSubscription: ReactivateSubscriptionUseCase;
  upgradeSubscription: UpgradeSubscriptionUseCase;
  downgradeSubscription: DowngradeSubscriptionUseCase;
  listPaymentMethods: ListPaymentMethodsUseCase;
  getPortalUrl: GetPortalUrlUseCase;
  listInvoices: ListInvoicesUseCase;
  getCurrentUsage: GetCurrentUsageUseCase;
  validatePromo: ValidatePromoUseCase;
  /** Pure derivation from Plan + feature name. Consumed by useTierGate. */
  checkFeatureAvailability: CheckFeatureAvailabilityUseCase;

  // F8 — Recordings + Share Links
  recordingsApi: RecordingsApiPort;
  shareApi: ShareApiPort;
  listRecordings: ListRecordingsUseCase;
  getRecordingPlayback: GetRecordingPlaybackUseCase;
  deleteRecording: DeleteRecordingUseCase;
  regenerateSessionSummary: RegenerateSessionSummaryUseCase;
  createShareLink: CreateShareLinkUseCase;
  listSessionShareLinks: ListSessionShareLinksUseCase;
  revokeShareLink: RevokeShareLinkUseCase;

  // F9 — Polish + A11Y + Observability
  analytics: AnalyticsPort;
  trackAnalyticsEvent: TrackAnalyticsEventUseCase;
}

export function useContainer(): SusurraContainer {
  const auth = useAuthAdapter();

  return useMemo<SusurraContainer>(() => {
    const state = auth.getState();
    const getToken =
      state.status === "authenticated" ? state.getToken : undefined;

    const apiClient: ApiClient = new FetchApiClient({
      baseUrl: API_BASE,
      ...(getToken ? { getToken } : {}),
    });

    const sessionsApi = new SessionsApiAdapter(apiClient);
    const speakersApi = new SpeakersApiAdapter(apiClient);
    const documentsApi = new DocumentsApiAdapter(apiClient, API_BASE, getToken);
    const personasApi = new PersonasApiAdapter(apiClient);
    const sessionMaterialsApi = new SessionMaterialsApiAdapter(apiClient);
    const preferencesApi = new PreferencesApiAdapter(apiClient);
    const integrationsApi = new IntegrationsApiAdapter(apiClient);
    const usersApi = new UsersApiAdapter(apiClient);
    const billingApi = new BillingApiAdapter(apiClient);
    const recordingsApi = new RecordingsApiAdapter(apiClient);
    const shareApi = new ShareApiAdapter(apiClient);

    const audioCapture = new TabShareAudioStrategy();
    const transcriptsStream = new TranscriptsStreamWS({ url: TRANSCRIPTS_WS_URL });
    const pipOverlay = new DocumentPipAdapter();
    const togglePipOverlay = new TogglePipOverlayUseCase(pipOverlay);

    // F9 — singleton analytics provider per window. Resolves to PostHog
    // adapter when NEXT_PUBLIC_POSTHOG_KEY is set, otherwise the noop.
    const analytics = createAnalytics();

    const audioUplinkFactory = (sessionId: string, userId: string): AudioUplinkPort =>
      new AudioUplinkWS({ baseUrl: AUDIO_WS_URL, sessionId, userId });

    const agentStreamFactory = (sessionId: string): AgentStreamPort =>
      new AgentStreamWS({
        baseUrl: AGENT_WS_URL,
        sessionId,
        ...(getToken ? { getToken } : {}),
      });

    return {
      auth,
      apiClient,
      getCurrentUser: new GetCurrentUserUseCase(apiClient),
      listScenarios: new ListScenariosUseCase(apiClient),

      audioCapture,
      transcriptsStream,
      audioUplinkFactory,
      agentStreamFactory,

      sessionsApi,
      speakersApi,

      createSession: new CreateSessionUseCase(sessionsApi),
      getSessionDetail: new GetSessionDetailUseCase(sessionsApi),
      recoverActiveSession: new RecoverActiveSessionUseCase(sessionsApi),
      endSession: new EndSessionUseCase(sessionsApi),
      listSpeakers: new ListSpeakersUseCase(speakersApi),
      renameSpeaker: new RenameSpeakerUseCase(speakersApi),

      documentsApi,
      listDocuments: new ListDocumentsUseCase(documentsApi),
      getDocument: new GetDocumentUseCase(documentsApi),
      uploadFileDocument: new UploadFileDocumentUseCase(documentsApi),
      uploadUrlDocument: new UploadUrlDocumentUseCase(documentsApi),
      uploadTextDocument: new UploadTextDocumentUseCase(documentsApi),
      updateDocument: new UpdateDocumentUseCase(documentsApi),
      deleteDocument: new DeleteDocumentUseCase(documentsApi),
      hasCvUploaded: new HasCvUploadedUseCase(documentsApi),

      personasApi,
      sessionMaterialsApi,
      listPersonas: new ListPersonasUseCase(personasApi),
      createPersona: new CreatePersonaUseCase(personasApi),
      getPersona: new GetPersonaUseCase(personasApi),
      updatePersona: new UpdatePersonaUseCase(personasApi),
      deletePersona: new DeletePersonaUseCase(personasApi),
      setDefaultPersona: new SetDefaultPersonaUseCase(personasApi),
      linkPersonaDocument: new LinkPersonaDocumentUseCase(personasApi),
      unlinkPersonaDocument: new UnlinkPersonaDocumentUseCase(personasApi),
      listSessionMaterials: new ListSessionMaterialsUseCase(sessionMaterialsApi),
      createSessionMaterial: new CreateSessionMaterialUseCase(sessionMaterialsApi),
      deleteSessionMaterial: new DeleteSessionMaterialUseCase(sessionMaterialsApi),

      getDashboardStats: new GetDashboardStatsUseCase(sessionsApi),
      listRecentSessions: new ListRecentSessionsUseCase(sessionsApi),
      listSessions: new ListSessionsUseCase(sessionsApi),
      deleteSession: new DeleteSessionUseCase(sessionsApi),

      pipOverlay,
      togglePipOverlay,

      preferencesApi,
      integrationsApi,
      usersApi,
      getPreferences: new GetPreferencesUseCase(preferencesApi),
      updatePreferences: new UpdatePreferencesUseCase(preferencesApi),
      updateUserProfile: new UpdateUserProfileUseCase(usersApi),
      deleteUserData: new DeleteUserDataUseCase(usersApi),
      listIntegrations: new ListIntegrationsUseCase(integrationsApi),

      billingApi,
      listPlans: new ListPlansUseCase(billingApi),
      getSubscription: new GetSubscriptionUseCase(billingApi),
      createCheckout: new CreateCheckoutUseCase(billingApi),
      cancelSubscription: new CancelSubscriptionUseCase(billingApi),
      reactivateSubscription: new ReactivateSubscriptionUseCase(billingApi),
      upgradeSubscription: new UpgradeSubscriptionUseCase(billingApi),
      downgradeSubscription: new DowngradeSubscriptionUseCase(billingApi),
      listPaymentMethods: new ListPaymentMethodsUseCase(billingApi),
      getPortalUrl: new GetPortalUrlUseCase(billingApi),
      listInvoices: new ListInvoicesUseCase(billingApi),
      getCurrentUsage: new GetCurrentUsageUseCase(billingApi),
      validatePromo: new ValidatePromoUseCase(billingApi),
      checkFeatureAvailability: new CheckFeatureAvailabilityUseCase(),

      recordingsApi,
      shareApi,
      listRecordings: new ListRecordingsUseCase(recordingsApi),
      getRecordingPlayback: new GetRecordingPlaybackUseCase(
        sessionsApi,
        recordingsApi,
      ),
      deleteRecording: new DeleteRecordingUseCase(recordingsApi),
      regenerateSessionSummary: new RegenerateSessionSummaryUseCase(sessionsApi),
      createShareLink: new CreateShareLinkUseCase(shareApi),
      listSessionShareLinks: new ListSessionShareLinksUseCase(shareApi),
      revokeShareLink: new RevokeShareLinkUseCase(shareApi),

      analytics,
      trackAnalyticsEvent: new TrackAnalyticsEventUseCase(analytics),
    };
  }, [auth]);
}
