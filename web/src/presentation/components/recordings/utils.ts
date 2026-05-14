/**
 * Recordings presentation utilities — shared formatters for the F8
 * components. Mirrors the spirit of `billing/utils.ts` (centralised so
 * components don't drift on locale/format).
 */

import type { ScenarioColor, ScenarioId } from "@/domain/entities/scenario";
import { scenarioColorOf } from "@/domain/entities/scenario";
import type { SharePermissions } from "@/domain/entities/share-link";

const ES_LOCALE = "es-419";

/** Formats seconds as mm:ss or h:mm:ss. */
export function formatDuration(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return "00:00";
  const sec = Math.floor(totalSeconds % 60);
  const min = Math.floor((totalSeconds / 60) % 60);
  const hr = Math.floor(totalSeconds / 3600);
  const pad = (n: number): string => String(n).padStart(2, "0");
  if (hr > 0) return `${hr}:${pad(min)}:${pad(sec)}`;
  return `${pad(min)}:${pad(sec)}`;
}

/** Formats a byte count as a human-readable string ("12.4 MB"). */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  const decimals = i === 0 ? 0 : 1;
  return `${value.toFixed(decimals)} ${units[i]}`;
}

/** "12 may 2026, 18:30" — short date+time for cards. */
export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString(ES_LOCALE, {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

/** "12 de mayo de 2026" — long Spanish date. */
export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString(ES_LOCALE, { dateStyle: "long" });
  } catch {
    return "—";
  }
}

/** Pretty Spanish label for a scenario id. */
export function scenarioLabel(id: ScenarioId): string {
  switch (id) {
    case "interview_dev":
      return "Entrevista";
    case "meeting_business":
      return "Reunión";
    case "exam_oral":
      return "Examen oral";
    case "sales_call":
      return "Venta";
    case "personal":
      return "Personal";
    default:
      return id;
  }
}

/** OKLCH variable name for a scenario color (matches design tokens). */
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

export function scenarioColorOfId(id: ScenarioId): ScenarioColor {
  return scenarioColorOf(id);
}

/** Spanish label for share permissions. */
export function permissionsLabel(p: SharePermissions): string {
  switch (p) {
    case "transcript_only":
      return "Solo transcripción";
    case "with_audio":
      return "Transcripción + audio";
    case "edit":
      return "Editable";
  }
}

/** Spanish label for a session title with fallback. */
export function sessionTitleOrFallback(
  title: string | null,
  scenario: ScenarioId,
  startedAt: string,
): string {
  if (title && title.trim().length > 0) return title;
  return `${scenarioLabel(scenario)} — ${formatDateTime(startedAt)}`;
}
