/**
 * DeleteMeetingUseCase — DELETE /api/meetings/{id}.
 *
 * Removes an owned meeting from the Susurra database (Sprint 1.5). Does
 * NOT delete the meeting on the provider side — a Meet space lingers on
 * Google until it gets GC'd. Returns ``true`` on success.
 */

import type { MeetingsApiPort } from "@/application/ports/meetings-api.port";

export class DeleteMeetingUseCase {
  constructor(private readonly api: MeetingsApiPort) {}

  execute(meetingId: string): Promise<boolean> {
    return this.api.deleteMeeting(meetingId);
  }
}
