/**
 * MeetingsApiPort — REST surface for creating + managing meetings on
 * third-party providers (Google Meet / Microsoft Teams / Zoom).
 *
 * Backend contract:
 *   POST   /api/meetings/meet/create — Sprint 1: returns the just-created Meeting row.
 *   GET    /api/meetings             — Sprint 1.5: lists the user's meetings.
 *   DELETE /api/meetings/{id}        — Sprint 1.5: removes an owned meeting.
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
  /**
   * List the authenticated user's meetings (newest-first, capped at 50).
   * Provider-agnostic — returns Meet / Teams / Zoom uniformly.
   */
  listMyMeetings(): Promise<Meeting[]>;
  /**
   * Delete an owned meeting from the Susurra database. Does NOT delete the
   * meeting on the provider side (a Meet space lingers until Google GCs
   * it). Returns true on success, throws on 404.
   */
  deleteMeeting(meetingId: string): Promise<boolean>;
}
