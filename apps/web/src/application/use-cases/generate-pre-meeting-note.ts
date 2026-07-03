/**
 * GeneratePreMeetingNoteUseCase — preview-only call to the LLM.
 *
 * Does NOT persist. The wizard surfaces the result for the user to
 * review BEFORE the session row exists. Persistence is a separate use
 * case fired AFTER POST /api/sessions returns.
 */

import type { PreMeetingNotesApiPort } from "@/application/ports/pre-meeting-notes-api.port";
import type {
  GeneratePreMeetingPayload,
  GeneratePreMeetingResult,
} from "@/domain/entities/pre-meeting-note";

export class GeneratePreMeetingNoteUseCase {
  constructor(private readonly api: PreMeetingNotesApiPort) {}

  execute(
    payload: GeneratePreMeetingPayload,
  ): Promise<GeneratePreMeetingResult> {
    return this.api.generate(payload);
  }
}
