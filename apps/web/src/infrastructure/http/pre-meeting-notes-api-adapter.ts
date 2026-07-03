/**
 * PreMeetingNotesApiAdapter — `PreMeetingNotesApiPort` impl backed by ApiClient.
 *
 * Endpoints:
 *   POST /api/pre-meeting-notes/generate
 *   POST /api/pre-meeting-notes
 *   GET  /api/sessions/{session_id}/pre-meeting-note
 *
 * The `getForSession` call returns `null` on 404 so the live UI can hide
 * the prep card without having to inspect the error message itself.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type { PreMeetingNotesApiPort } from "@/application/ports/pre-meeting-notes-api.port";
import type {
  CreatePreMeetingPayload,
  GeneratePreMeetingPayload,
  GeneratePreMeetingResult,
  PreMeetingNote,
} from "@/domain/entities/pre-meeting-note";

interface PreMeetingNoteResponseRaw {
  id: string;
  session_id: string;
  user_id: string;
  role_target: string;
  company_context: string;
  job_description: string | null;
  probing_questions: string[];
  prep_checklist: string[];
  raw_user_input: string;
  created_at: string;
}

interface GeneratePreMeetingResponseRaw {
  probing_questions: string[];
  prep_checklist: string[];
}

function mapNote(raw: PreMeetingNoteResponseRaw): PreMeetingNote {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    userId: raw.user_id,
    roleTarget: raw.role_target,
    companyContext: raw.company_context,
    jobDescription: raw.job_description,
    probingQuestions: [...raw.probing_questions],
    prepChecklist: [...raw.prep_checklist],
    rawUserInput: raw.raw_user_input,
    createdAt: raw.created_at,
  };
}

function toGenerateBody(
  input: GeneratePreMeetingPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    scenario_id: input.scenarioId,
    role_target: input.roleTarget,
    company_context: input.companyContext,
    raw_user_input: input.rawUserInput,
  };
  if (input.personaId !== undefined && input.personaId !== null) {
    body["persona_id"] = input.personaId;
  }
  if (input.jobDescription) {
    body["job_description"] = input.jobDescription;
  }
  return body;
}

function toCreateBody(
  input: CreatePreMeetingPayload,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    session_id: input.sessionId,
    role_target: input.roleTarget,
    company_context: input.companyContext,
    probing_questions: [...input.probingQuestions],
    prep_checklist: [...input.prepChecklist],
    raw_user_input: input.rawUserInput,
  };
  if (input.jobDescription) {
    body["job_description"] = input.jobDescription;
  }
  return body;
}

export class PreMeetingNotesApiAdapter implements PreMeetingNotesApiPort {
  constructor(private readonly api: ApiClient) {}

  async generate(
    payload: GeneratePreMeetingPayload,
  ): Promise<GeneratePreMeetingResult> {
    const raw = await this.api.post<GeneratePreMeetingResponseRaw>(
      `/api/pre-meeting-notes/generate`,
      toGenerateBody(payload),
    );
    return {
      probingQuestions: [...raw.probing_questions],
      prepChecklist: [...raw.prep_checklist],
    };
  }

  async create(payload: CreatePreMeetingPayload): Promise<PreMeetingNote> {
    const raw = await this.api.post<PreMeetingNoteResponseRaw>(
      `/api/pre-meeting-notes`,
      toCreateBody(payload),
    );
    return mapNote(raw);
  }

  async getForSession(sessionId: string): Promise<PreMeetingNote | null> {
    try {
      const raw = await this.api.get<PreMeetingNoteResponseRaw>(
        `/api/sessions/${encodeURIComponent(sessionId)}/pre-meeting-note`,
      );
      return mapNote(raw);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (/\bAPI 404\b/.test(msg)) return null;
      throw e;
    }
  }
}

export const __testing = { mapNote, toGenerateBody, toCreateBody };
