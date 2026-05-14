/**
 * GetDashboardStatsUseCase — computes monthly stats from the sessions list.
 *
 * Strategy (MVP, client-side aggregation):
 *  - Fetch up to `pageSize` recent sessions (default 100).
 *  - Filter by `startedAt >= start of current month`.
 *  - Sum durationSeconds for the totalDuration.
 *  - Tally scenario counts → pick the highest as topScenario.
 *
 * Trade-offs:
 *  - Heavy users (>100 sessions/mo) get truncated stats — acceptable for MVP.
 *  - Single round-trip, no extra backend endpoint required.
 */

import type { DashboardStats } from "@/domain/entities/dashboard-stats";
import type { SessionsApiPort } from "@/application/ports/sessions-api.port";

export class GetDashboardStatsUseCase {
  constructor(private readonly sessionsApi: SessionsApiPort) {}

  async execute(pageSize = 100): Promise<DashboardStats> {
    const sessions = await this.sessionsApi.list({
      limit: pageSize,
      offset: 0,
    });

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const thisMonth = sessions.filter((s) => {
      const startedAt = new Date(s.startedAt);
      return startedAt >= startOfMonth;
    });

    let totalDuration = 0;
    const scenarioCounts = new Map<string, number>();

    for (const s of thisMonth) {
      if (s.durationSeconds != null) {
        totalDuration += s.durationSeconds;
      }
      const prev = scenarioCounts.get(s.scenario) ?? 0;
      scenarioCounts.set(s.scenario, prev + 1);
    }

    let topScenarioId: string | null = null;
    let topScenarioCount = 0;
    for (const [id, count] of scenarioCounts) {
      if (count > topScenarioCount) {
        topScenarioCount = count;
        topScenarioId = id;
      }
    }

    return {
      sessionsThisMonth: thisMonth.length,
      totalDurationSecondsThisMonth: totalDuration,
      topScenarioId,
      topScenarioCount,
    };
  }
}
