/**
 * MeetingsApiAdapter — concrete `MeetingsApiPort` impl backed by `ApiClient`.
 *
 * Backend reference (`python_backend/app/presentation/api/meetings_router.py`):
 *   POST   /api/meetings/meet/create  → CreateMeetResponse  (Sprint 1)
 *   GET    /api/meetings              → MeetingResponse[]   (Sprint 1.5)
 *   DELETE /api/meetings/{id}         → DeleteMeetingResponse (Sprint 1.5)
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping for the response.
 *  - Map epoch-ms `created_at` from the backend to an ISO string so the
 *    domain `Meeting` entity carries the camelCase / ISO contract.
 *  - Reject unsupported providers (microsoft / zoom) at the boundary —
 *    they'll be wired in Sprints 2/3.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  CreateMeetingInput,
  MeetingsApiPort,
} from "@/application/ports/meetings-api.port";
import type { Meeting } from "@/domain/entities/meeting";
import type { MeetingProviderId } from "@/domain/entities/meeting-provider-id";

interface CreateMeetResponseRaw {
  id: string;
  provider: MeetingProviderId;
  join_url: string;
  title: string | null;
  created_at: number; // epoch ms
}

interface MeetingResponseRaw {
  id: string;
  provider: MeetingProviderId;
  join_url: string;
  title: string | null;
  created_at: number; // epoch ms
  provider_meeting_id: string;
}

interface DeleteMeetingResponseRaw {
  deleted: boolean;
}

function mapMeeting(
  raw: CreateMeetResponseRaw | MeetingResponseRaw,
): Meeting {
  const base: Meeting = {
    id: raw.id,
    providerId: raw.provider,
    joinUrl: raw.join_url,
    createdAt: new Date(raw.created_at).toISOString(),
  };
  return raw.title ? { ...base, title: raw.title } : base;
}

export class MeetingsApiAdapter implements MeetingsApiPort {
  constructor(private readonly api: ApiClient) {}

  async createMeeting(input: CreateMeetingInput): Promise<Meeting> {
    if (input.provider !== "meet") {
      throw new Error(
        `Provider "${input.provider}" not yet supported. Use "meet" (Sprint 1).`,
      );
    }
    const body: { title?: string } = {};
    if (input.title) body.title = input.title;
    const raw = await this.api.post<CreateMeetResponseRaw>(
      "/api/meetings/meet/create",
      body,
    );
    return mapMeeting(raw);
  }

  async listMyMeetings(): Promise<Meeting[]> {
    const raw = await this.api.get<MeetingResponseRaw[]>("/api/meetings");
    return raw.map(mapMeeting);
  }

  async deleteMeeting(meetingId: string): Promise<boolean> {
    const raw = await this.api.delete<DeleteMeetingResponseRaw>(
      `/api/meetings/${encodeURIComponent(meetingId)}`,
    );
    return raw.deleted === true;
  }
}

export const __testing = { mapMeeting };
