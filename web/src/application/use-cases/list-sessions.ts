/**
 * ListSessionsUseCase — GET /api/sessions with optional filters.
 *
 * Backend returns rows ordered by `started_at DESC`. Used by the
 * /app/sessions list page which needs scenario + search filtering and a
 * higher limit than the dashboard's 5 recent rows.
 */

import type { Session } from "@/domain/entities/session";
import type { SessionsApiPort } from "@/application/ports/sessions-api.port";

export interface ListSessionsParams {
  scenario?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export class ListSessionsUseCase {
  constructor(private readonly sessionsApi: SessionsApiPort) {}

  async execute(params: ListSessionsParams = {}): Promise<Session[]> {
    return this.sessionsApi.list(params);
  }
}
