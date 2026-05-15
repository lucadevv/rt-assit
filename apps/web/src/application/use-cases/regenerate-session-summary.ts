/**
 * RegenerateSessionSummaryUseCase — POST /api/sessions/{id}/regenerate-summary.
 *
 * The backend kicks off the LLM summary generation in a background task
 * and returns the CURRENT Session row immediately — the caller is
 * expected to refetch the detail (or summary) endpoint a few seconds
 * later to observe the updated `summary` and `actionItems`.
 */

import type { SessionsApiPort } from "@/application/ports/sessions-api.port";
import type { Session } from "@/domain/entities/session";

export class RegenerateSessionSummaryUseCase {
  constructor(private readonly api: SessionsApiPort) {}

  execute(sessionId: string): Promise<Session> {
    return this.api.regenerateSummary(sessionId);
  }
}
