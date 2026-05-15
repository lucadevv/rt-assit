/**
 * ListMyMeetingsUseCase — GET /api/meetings.
 *
 * Returns every meeting the authenticated user owns (Meet / Teams / Zoom),
 * newest-first, capped at 50. Sprint 1.5.
 */

import type { MeetingsApiPort } from "@/application/ports/meetings-api.port";
import type { Meeting } from "@/domain/entities/meeting";

export class ListMyMeetingsUseCase {
  constructor(private readonly api: MeetingsApiPort) {}

  execute(): Promise<Meeting[]> {
    return this.api.listMyMeetings();
  }
}
