/**
 * SpeakersApiAdapter — `SpeakersApiPort` implementation using ApiClient.
 *
 * Note: backend's rename endpoint accepts `{ "label": null }` to clear
 * the label (sets back to anonymous). We forward null as-is.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type { SpeakersApiPort } from "@/application/ports/speakers-api.port";
import type { Speaker } from "@/domain/entities/speaker";
import { mapSpeaker } from "./sessions-api-adapter";

interface SpeakerResponseRaw {
  id: number;
  session_id: string;
  deepgram_speaker_id: number;
  label: string | null;
  is_user: boolean;
  color_hint: string;
}

export class SpeakersApiAdapter implements SpeakersApiPort {
  constructor(private readonly api: ApiClient) {}

  async list(sessionId: string): Promise<Speaker[]> {
    const raw = await this.api.get<SpeakerResponseRaw[]>(
      `/api/sessions/${encodeURIComponent(sessionId)}/speakers`,
    );
    return raw.map(mapSpeaker);
  }

  async rename(
    sessionId: string,
    deepgramSpeakerId: number,
    label: string | null,
  ): Promise<Speaker> {
    const raw = await this.api.post<SpeakerResponseRaw>(
      `/api/sessions/${encodeURIComponent(sessionId)}/speakers/${deepgramSpeakerId}/rename`,
      { label },
    );
    return mapSpeaker(raw);
  }

  async merge(
    sessionId: string,
    label: string,
    deepgramSpeakerIds: readonly number[],
  ): Promise<Speaker[]> {
    const raw = await this.api.post<SpeakerResponseRaw[]>(
      `/api/sessions/${encodeURIComponent(sessionId)}/speakers/merge`,
      { label, deepgram_speaker_ids: deepgramSpeakerIds },
    );
    return raw.map(mapSpeaker);
  }
}
