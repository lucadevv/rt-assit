/**
 * GetPreMeetingNoteForSessionUseCase — fetch the wizard output for the
 * live session UI.
 *
 * Returns null when no note exists (the adapter swallows 404 so the
 * presentation layer can branch on null instead of try/catch).
 */

import type { PreMeetingNotesApiPort } from "@/application/ports/pre-meeting-notes-api.port";
import type { PreMeetingNote } from "@/domain/entities/pre-meeting-note";

export class GetPreMeetingNoteForSessionUseCase {
  constructor(private readonly api: PreMeetingNotesApiPort) {}

  execute(sessionId: string): Promise<PreMeetingNote | null> {
    return this.api.getForSession(sessionId);
  }
}
