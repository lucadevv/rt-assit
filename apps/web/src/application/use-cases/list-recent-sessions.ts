/**
 * ListRecentSessionsUseCase — fetches the most recent sessions for the home
 * dashboard.
 *
 * Thin wrapper around `SessionsApiPort.list`. Backend already returns rows
 * ordered by `started_at DESC`, so we just pass `limit` and read the head.
 */

import type { Session } from "@/domain/entities/session";
import type { SessionsApiPort } from "@/application/ports/sessions-api.port";

export class ListRecentSessionsUseCase {
  constructor(private readonly sessionsApi: SessionsApiPort) {}

  async execute(limit = 5): Promise<Session[]> {
    return this.sessionsApi.list({ limit, offset: 0 });
  }
}
