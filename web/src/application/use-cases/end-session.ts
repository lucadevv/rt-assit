/**
 * EndSessionUseCase — POST /api/sessions/{id}/end.
 *
 * Backend sets `ended_at` + duration and schedules summary generation as
 * a background task. Returns the updated session row (summary not yet
 * populated; the user can poll /summary later or rely on the dashboard).
 */

import type { Session } from "@/domain/entities/session";
import type { SessionsApiPort } from "@/application/ports/sessions-api.port";

export class EndSessionUseCase {
  constructor(private readonly api: SessionsApiPort) {}

  execute(sessionId: string): Promise<Session> {
    return this.api.end(sessionId);
  }
}
