/**
 * RecoverActiveSessionUseCase — GET /api/sessions/active.
 *
 * FR-22 — on page mount we call this; if the backend has an unfinished
 * session for this user we restore the UI to that session (transcripts,
 * speakers, hints rendered visually). The audio capture itself is NOT
 * resumed — the browser requires a user gesture for getDisplayMedia.
 */

import type { Session } from "@/domain/entities/session";
import type { SessionsApiPort } from "@/application/ports/sessions-api.port";

export class RecoverActiveSessionUseCase {
  constructor(private readonly api: SessionsApiPort) {}

  execute(): Promise<Session | null> {
    return this.api.active();
  }
}
