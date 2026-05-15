/**
 * SessionMaterial domain entity — TS mirror of the backend
 * `session_materials` row.
 *
 * A SessionMaterial is an ad-hoc piece of context attached to a
 * single session: a brief, an agenda, an objective, a link, a note,
 * or a file. Distinct from `Document` — documents are reusable
 * across sessions, materials are scoped to one session and created
 * inside the NewSessionModal.
 *
 * Pure data — no framework / infrastructure imports allowed
 * (Clean Arch mandate). snake_case ↔ camelCase mapping lives in
 * the infrastructure adapter.
 *
 * Backend reference shape (from H3 spec):
 *   {
 *     id: number,
 *     session_id: string,
 *     material_type: "brief" | "agenda" | "objective" | "link" | "note" | "file",
 *     title: string | null,
 *     content: string | null,
 *     source_url: string | null,
 *     created_at: string
 *   }
 */

export type SessionMaterialType =
  | "brief"
  | "agenda"
  | "objective"
  | "link"
  | "note"
  | "file";

export interface SessionMaterial {
  id: number;
  sessionId: string;
  materialType: SessionMaterialType;
  title: string | null;
  content: string | null;
  sourceUrl: string | null;
  /** ISO 8601 timestamp string. */
  createdAt: string;
}

export const SESSION_MATERIAL_TYPE_LABELS: Record<SessionMaterialType, string> =
  {
    brief: "Brief",
    agenda: "Agenda",
    objective: "Objetivo",
    link: "Link",
    note: "Nota",
    file: "Archivo",
  };

export const SESSION_MATERIAL_TYPE_ICONS: Record<SessionMaterialType, string> = {
  brief: "\u{1F4CB}",
  agenda: "\u{1F4C5}",
  objective: "\u{1F3AF}",
  link: "\u{1F517}",
  note: "\u{1F5D2}\u{FE0F}",
  file: "\u{1F4CE}",
};

const VALID_TYPES: ReadonlySet<string> = new Set([
  "brief",
  "agenda",
  "objective",
  "link",
  "note",
  "file",
]);

export function isSessionMaterialType(
  value: string,
): value is SessionMaterialType {
  return VALID_TYPES.has(value);
}

export function normaliseSessionMaterialType(
  value: string,
): SessionMaterialType {
  return isSessionMaterialType(value) ? value : "note";
}
