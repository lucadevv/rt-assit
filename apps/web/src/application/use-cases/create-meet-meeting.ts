/**
 * CreateMeetMeetingUseCase — POST /api/meetings/meet/create.
 *
 * Asks the backend to create a Google Meet space owned by the
 * authenticated user. Returns the persisted `Meeting` entity (including
 * the join URL the UI copies to clipboard).
 *
 * Provider is hardcoded to `"meet"` for Sprint 1; a future sibling use
 * case will exist per provider, or the modal can call the API port
 * directly with a discriminator once the selector UI ships in Sprint 4.
 */

import type { MeetingsApiPort } from "@/application/ports/meetings-api.port";
import type { Meeting } from "@/domain/entities/meeting";

export class CreateMeetMeetingUseCase {
  constructor(private readonly api: MeetingsApiPort) {}

  execute(title?: string): Promise<Meeting> {
    const input: { provider: "meet"; title?: string } = { provider: "meet" };
    if (title) input.title = title;
    return this.api.createMeeting(input);
  }
}
