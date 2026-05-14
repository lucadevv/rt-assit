/**
 * Sessions presentation utilities — shared formatters for the
 * `/app/sessions` list + detail pages.
 *
 * Lives in `presentation/components/sessions/` to mirror the recordings
 * convention (`recordings/utils.ts`). We deliberately do NOT import from
 * `recordings/utils.ts` to keep components self-contained per feature
 * (avoid cross-feature coupling).
 */

import type { ScenarioColor, ScenarioId } from "@/domain/entities/scenario";
import type { Session } from "@/domain/entities/session";
import { scenarioColorOf } from "@/domain/entities/scenario";

const ES_LOCALE = "es-419";

/**
 * Formats a session duration as a friendly Spanish string.
 *  - 0..59s     → "Xs"
 *  - 1..59 min  → "X min Ys"  (omit seconds if 0)
 *  - >=60 min   → "X h Y min" (omit minutes if 0)
 */
export function formatSessionDuration(seconds: number | null): string {
  if (seconds === null || seconds < 0) return "—";
  if (seconds === 0) return "0s";
  const totalSeconds = Math.floor(seconds);
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const remSeconds = totalSeconds % 60;
  if (minutes < 60) {
    if (remSeconds === 0) return `${minutes} min`;
    return `${minutes} min ${remSeconds}s`;
  }
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  if (remMinutes === 0) return `${hours} h`;
  return `${hours} h ${remMinutes} min`;
}

/** "12 may, 18:30" — short date+time for list rows. */
export function formatStartedAtShort(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(ES_LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "12 de mayo de 2026, 18:30" — long date for detail hero. */
export function formatStartedAtLong(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(ES_LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Derives the effective display status — mirrors backend semantics but
 * also catches the "abandoned" edge case the task spec calls out:
 * `duration_seconds === 0 && ended_at != null`.
 */
export function effectiveStatus(session: Session): Session["status"] {
  if (
    session.endedAt !== null &&
    (session.durationSeconds ?? 0) === 0 &&
    session.status !== "active"
  ) {
    return "abandoned";
  }
  return session.status;
}

export const STATUS_LABEL: Record<Session["status"], string> = {
  active: "Activa",
  ended: "Finalizada",
  abandoned: "Abandonada",
};

/** Map a status to a Pill variant. */
export function statusPillVariant(
  status: Session["status"],
): "lime" | "ghost" | "amber" {
  if (status === "active") return "lime";
  if (status === "abandoned") return "amber";
  return "ghost";
}

/** Pretty Spanish label for a scenario id (fallback to id when unknown). */
export function scenarioLabel(
  id: ScenarioId,
  catalog?: { id: string; label: string }[],
): string {
  if (catalog) {
    const found = catalog.find((s) => s.id === id);
    if (found) return found.label;
  }
  switch (id) {
    case "interview_dev":
      return "Entrevista técnica";
    case "interview_behavioral":
      return "Entrevista behavioral";
    case "meeting_business":
      return "Reunión";
    case "exam_oral":
      return "Examen oral";
    case "thesis_defense":
      return "Defensa de tesis";
    case "sales_call":
      return "Venta";
    case "client_call":
      return "Llamada con cliente";
    case "personal":
      return "Personal";
    default:
      return id;
  }
}

/** OKLCH variable name for a scenario color. */
export function scenarioColorVar(color: ScenarioColor): string {
  switch (color) {
    case "cyan":
      return "var(--color-cyan)";
    case "amber":
      return "var(--color-amber)";
    case "lavender":
      return "var(--color-lavender)";
    case "lime":
      return "var(--color-lime)";
  }
}

/** Session title with a Spanish fallback. */
export function sessionTitleOrFallback(
  title: string | null,
  scenario: ScenarioId,
  startedAt: string,
  catalog?: { id: string; label: string }[],
): string {
  if (title && title.trim().length > 0) return title;
  return `${scenarioLabel(scenario, catalog)} — ${formatStartedAtShort(startedAt)}`;
}

/** Re-export so consumers don't need a second import. */
export { scenarioColorOf };

/**
 * Relative timestamp like "+12s", "+4 min 20s", "+1 h 5 min" — computed
 * from milliseconds since session start. Used in the transcript list.
 */
export function formatRelativeMs(timestampMs: number): string {
  if (!Number.isFinite(timestampMs) || timestampMs < 0) return "+0s";
  const totalSeconds = Math.floor(timestampMs / 1000);
  return `+${formatSessionDuration(totalSeconds)}`;
}
