/**
 * DashboardStats — computed/derived view used by the Home dashboard.
 *
 * No backend table; built client-side by aggregating sessions of the
 * current month. Pure data, Clean Architecture-safe.
 *
 * Fields:
 *  - sessionsThisMonth: count of sessions started in the current month.
 *  - totalDurationSecondsThisMonth: sum of durationSeconds of those sessions.
 *  - topScenarioId: the scenario id with the most sessions this month
 *    (null when there are no sessions yet).
 *  - topScenarioCount: how many sessions used the top scenario.
 */

export interface DashboardStats {
  sessionsThisMonth: number;
  totalDurationSecondsThisMonth: number;
  topScenarioId: string | null;
  topScenarioCount: number;
}
