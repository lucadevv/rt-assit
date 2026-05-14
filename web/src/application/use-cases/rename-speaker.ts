/**
 * RenameSpeakerUseCase — POST /api/sessions/{id}/speakers/{dgId}/rename.
 *
 * Backend persists the label and broadcasts `speaker_label_updated` over
 * the agent WS. The orchestrator hook (use-rename-speaker) does an
 * optimistic store update and reconciles with the WS event when it
 * arrives.
 */

import type { Speaker } from "@/domain/entities/speaker";
import type { SpeakersApiPort } from "@/application/ports/speakers-api.port";

export class RenameSpeakerUseCase {
  constructor(private readonly api: SpeakersApiPort) {}

  execute(
    sessionId: string,
    deepgramSpeakerId: number,
    label: string | null,
  ): Promise<Speaker> {
    return this.api.rename(sessionId, deepgramSpeakerId, label);
  }
}
