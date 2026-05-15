/**
 * MeetingsApiPort — REST surface for creating meetings on third-party
 * providers (Google Meet / Microsoft Teams / Zoom).
 *
 * Backend contract (Sprint 1, Meet only):
 *   POST /api/meetings/meet/create — returns the just-created Meeting row.
 *
 * Sprints 2/3 will add `teams/create` and `zoom/create`. The port stays
 * provider-agnostic via the `provider` discriminator on the input.
 */

import type { Meeting } from "@/domain/entities/meeting";
import type { MeetingProviderId } from "@/domain/entities/meeting-provider-id";

export interface CreateMeetingInput {
  provider: MeetingProviderId;
  title?: string;
}

export interface MeetingsApiPort {
  createMeeting(input: CreateMeetingInput): Promise<Meeting>;
}
