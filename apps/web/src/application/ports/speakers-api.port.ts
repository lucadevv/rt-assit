/**
 * SpeakersApiPort — REST surface for B3 speakers/diarisation.
 *
 *   GET    /api/sessions/{id}/speakers
 *   POST   /api/sessions/{id}/speakers/{deepgram_id}/rename
 *   POST   /api/sessions/{id}/speakers/merge
 */

import type { Speaker } from "@/domain/entities/speaker";

export interface SpeakersApiPort {
  list(sessionId: string): Promise<Speaker[]>;
  rename(
    sessionId: string,
    deepgramSpeakerId: number,
    label: string | null,
  ): Promise<Speaker>;
  merge(
    sessionId: string,
    label: string,
    deepgramSpeakerIds: readonly number[],
  ): Promise<Speaker[]>;
}
