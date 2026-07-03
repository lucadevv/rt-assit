/**
 * CreatePreMeetingNoteUseCase — persist the wizard output onto a session.
 *
 * Called AFTER POST /api/sessions has returned the new session id. The
 * NewSessionModal threads the generated probingQuestions + prepChecklist
 * into this call so the LLM doesn't have to re-run.
 */

import type { PreMeetingNotesApiPort } from "@/application/ports/pre-meeting-notes-api.port";
import type {
  CreatePreMeetingPayload,
  PreMeetingNote,
} from "@/domain/entities/pre-meeting-note";

export class CreatePreMeetingNoteUseCase {
  constructor(private readonly api: PreMeetingNotesApiPort) {}

  execute(payload: CreatePreMeetingPayload): Promise<PreMeetingNote> {
    return this.api.create(payload);
  }
}
