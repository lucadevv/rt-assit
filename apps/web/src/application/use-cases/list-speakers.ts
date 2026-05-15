/**
 * ListSpeakersUseCase — GET /api/sessions/{id}/speakers.
 */

import type { Speaker } from "@/domain/entities/speaker";
import type { SpeakersApiPort } from "@/application/ports/speakers-api.port";

export class ListSpeakersUseCase {
  constructor(private readonly api: SpeakersApiPort) {}

  execute(sessionId: string): Promise<Speaker[]> {
    return this.api.list(sessionId);
  }
}
