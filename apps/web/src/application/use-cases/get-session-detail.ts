/**
 * GetSessionDetailUseCase — GET /api/sessions/{id}.
 *
 * Returns the full detail (session + transcripts + hints + speakers + tags)
 * — used during recovery to repopulate the live UI without restarting
 * audio capture (which requires a user gesture).
 */

import type {
  SessionDetail,
  SessionsApiPort,
} from "@/application/ports/sessions-api.port";

export class GetSessionDetailUseCase {
  constructor(private readonly api: SessionsApiPort) {}

  execute(sessionId: string): Promise<SessionDetail> {
    return this.api.detail(sessionId);
  }
}
