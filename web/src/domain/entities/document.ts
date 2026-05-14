/**
 * Document domain entity — TS mirror of `python_backend/app/domain/entities/document.py`.
 *
 * Pure data — no framework or infrastructure imports allowed (Clean Arch
 * mandate). The shape uses camelCase for the application layer; the
 * snake_case → camelCase translation lives in the infrastructure adapter.
 *
 * Business rules:
 *  - `cv`, `profile`, `linkedin`, `bio` and `reference` are GLOBAL — they
 *    apply to every scenario the user has, so `scenario` must be `null`.
 *    The identity subset (cv/profile/linkedin/bio) mirrors backend
 *    `IDENTITY_DOC_TYPES`.
 *  - `job_offer`, `company_research`, `meeting_brief`, `account_history`,
 *    `case_study`, `playbook`, `exam_syllabus`, `evaluation_criteria`,
 *    `persona` are SCENARIO-SCOPED — `scenario` should be a non-null id of
 *    an existing scenario the user has, but the UI allows demoting to
 *    global if useful.
 *  - `other` can be either; UI defaults to scenario-scoped if a current
 *    scenario is set.
 */

export type DocType =
  | "cv"
  | "profile"
  | "linkedin"
  | "bio"
  | "job_offer"
  | "company_research"
  | "meeting_brief"
  | "account_history"
  | "case_study"
  | "playbook"
  | "exam_syllabus"
  | "evaluation_criteria"
  | "persona"
  | "reference"
  | "other";

export interface Document {
  id: number;
  userId: string;
  docType: DocType;
  /** null = global, applies to all scenarios */
  scenario: string | null;
  title: string;
  content: string;
  /** filename, URL, or "pasted" */
  source: string | null;
  metadata: Record<string, unknown>;
  /** ISO 8601 timestamp string */
  uploadedAt: string;
  sizeChars: number;
  /**
   * Identity primary flag — only one document per (user, scenario-or-global)
   * tuple may be marked primary. Backend is authoritative for the constraint;
   * the UI updates optimistically and reconciles on the next refresh.
   *
   * Wave 1B: backend may not yet round-trip this field via the GET endpoints;
   * in that case it stays `false` until backend support lands.
   */
  isPrimary?: boolean;
}

export interface DocumentListItem {
  id: number;
  docType: DocType;
  scenario: string | null;
  title: string;
  source: string | null;
  uploadedAt: string;
  sizeChars: number;
  metadata: Record<string, unknown>;
  /** See Document.isPrimary. Optional for forward-compat with older backends. */
  isPrimary?: boolean;
}

export const DOC_TYPE_LABELS: Record<DocType, string> = {
  cv: "Currículum Vitae",
  profile: "Perfil",
  linkedin: "LinkedIn",
  bio: "Bio",
  job_offer: "Oferta de trabajo",
  company_research: "Research de empresa",
  meeting_brief: "Brief de reunión",
  account_history: "Historial de cuenta",
  case_study: "Caso de éxito",
  playbook: "Playbook",
  exam_syllabus: "Programa de examen",
  evaluation_criteria: "Criterios de evaluación",
  persona: "Persona custom",
  reference: "Material de referencia",
  other: "Otro",
};

export const DOC_TYPE_ICONS: Record<DocType, string> = {
  cv: "📄",
  profile: "🪪",
  linkedin: "💼",
  bio: "📜",
  job_offer: "💼",
  company_research: "🔎",
  meeting_brief: "📋",
  account_history: "📊",
  case_study: "🏆",
  playbook: "📘",
  exam_syllabus: "🎓",
  evaluation_criteria: "📏",
  persona: "🎭",
  reference: "📚",
  other: "📎",
};

export const GLOBAL_DOC_TYPES: readonly DocType[] = [
  "cv",
  "profile",
  "linkedin",
  "bio",
  "reference",
];

export const SCENARIO_SCOPED_DOC_TYPES: readonly DocType[] = [
  "job_offer",
  "company_research",
  "meeting_brief",
  "account_history",
  "case_study",
  "playbook",
  "exam_syllabus",
  "evaluation_criteria",
  "persona",
];

export const ALL_DOC_TYPES: readonly DocType[] = [
  ...GLOBAL_DOC_TYPES,
  ...SCENARIO_SCOPED_DOC_TYPES,
  "other",
];

const VALID_DOC_TYPES = new Set<string>(ALL_DOC_TYPES);

export function isDocType(value: string): value is DocType {
  return VALID_DOC_TYPES.has(value);
}

export function normaliseDocType(value: string): DocType {
  return isDocType(value) ? value : "other";
}

/** Whether a doc type can never be tied to a scenario. */
export function isGlobalOnlyDocType(t: DocType): boolean {
  return (GLOBAL_DOC_TYPES as readonly DocType[]).includes(t);
}
