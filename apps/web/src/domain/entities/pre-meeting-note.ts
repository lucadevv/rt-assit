/**
 * PreMeetingNote — AI-generated prep attached to a session.
 *
 * Created via the Pre-Interview Wizard inside NewSessionModal for the
 * interview_dev and interview_behavioral scenarios. Two parallel arrays:
 *   - probingQuestions: English (interview language).
 *   - prepChecklist: es-LATAM voseo (prep language).
 *
 * Pure data — no framework or infrastructure dependencies. Mirrors the
 * backend ``PreMeetingNote`` dataclass field-for-field with camelCase.
 */

export interface PreMeetingNote {
  id: string;
  sessionId: string;
  userId: string;
  roleTarget: string;
  companyContext: string;
  jobDescription: string | null;
  probingQuestions: readonly string[];
  prepChecklist: readonly string[];
  rawUserInput: string;
  createdAt: string;
}

export interface GeneratePreMeetingPayload {
  scenarioId: string;
  personaId?: number | null;
  roleTarget: string;
  companyContext: string;
  jobDescription?: string | null;
  rawUserInput: string;
}

export interface GeneratePreMeetingResult {
  probingQuestions: readonly string[];
  prepChecklist: readonly string[];
}

export interface CreatePreMeetingPayload {
  sessionId: string;
  roleTarget: string;
  companyContext: string;
  jobDescription?: string | null;
  probingQuestions: readonly string[];
  prepChecklist: readonly string[];
  rawUserInput: string;
}
