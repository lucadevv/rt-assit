/**
 * PreMeetingNotesApiPort — REST contract for the Pre-Interview Wizard.
 *
 * Backend reference:
 *   POST /api/pre-meeting-notes/generate      (preview-only)
 *   POST /api/pre-meeting-notes               (persist after preview)
 *   GET  /api/sessions/{id}/pre-meeting-note  (read for the live UI)
 *
 * Use cases consume this interface (not the adapter) so they stay
 * mockable. Adapter handles snake_case <-> camelCase mapping.
 */

import type {
  CreatePreMeetingPayload,
  GeneratePreMeetingPayload,
  GeneratePreMeetingResult,
  PreMeetingNote,
} from "@/domain/entities/pre-meeting-note";

export interface PreMeetingNotesApiPort {
  generate(
    payload: GeneratePreMeetingPayload,
  ): Promise<GeneratePreMeetingResult>;
  create(payload: CreatePreMeetingPayload): Promise<PreMeetingNote>;
  getForSession(sessionId: string): Promise<PreMeetingNote | null>;
}
