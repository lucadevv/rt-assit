/**
 * Persona domain entity — TS mirror of the backend `personas` row.
 *
 * A Persona is a user-curated identity preset (name, tone, scenario
 * preference, custom prompt) used when starting a session. The
 * persona id is threaded into the session creation payload via
 * `metadata.persona_id` so the backend prompt builder picks it up
 * without a new REST contract.
 *
 * Pure data — no framework / infrastructure imports allowed
 * (Clean Arch mandate). snake_case ↔ camelCase mapping lives in
 * the infrastructure adapter.
 *
 * Backend reference shape (from H3 spec):
 *   {
 *     id: number,
 *     user_id: string,
 *     name: string,
 *     description: string | null,
 *     scenario_id: string | null,
 *     icon: string | null,         // emoji
 *     tone: "professional" | "casual" | "formal" | null,
 *     custom_instructions: string | null,
 *     is_default: boolean,
 *     created_at: string,
 *     updated_at: string
 *   }
 */

export type PersonaTone = "professional" | "casual" | "formal";

export interface Persona {
  id: number;
  userId: string;
  name: string;
  description: string | null;
  scenarioId: string | null;
  /** Emoji glyph (single character / cluster). */
  icon: string | null;
  tone: PersonaTone | null;
  customInstructions: string | null;
  isDefault: boolean;
  /** ISO 8601 timestamp string. */
  createdAt: string;
  /** ISO 8601 timestamp string. */
  updatedAt: string;
}

/** Curated emoji picker for the persona editor. */
export const PERSONA_ICON_PRESETS: readonly string[] = [
  "\u{1F464}", // 👤
  "\u{1F3E2}", // 🏢
  "\u{1F393}", // 🎓
  "\u{1F4BC}", // 💼
  "\u{1F4DE}", // 📞
  "\u{1F3A4}", // 🎤
  "\u{1F4CA}", // 📊
  "\u{1F52C}", // 🔬
  "\u{1F9D1}", // 🧑
  "\u{1F9E0}", // 🧠
  "\u{1F4D6}", // 📖
  "\u{1F680}", // 🚀
];

const VALID_TONES: ReadonlySet<string> = new Set([
  "professional",
  "casual",
  "formal",
]);

export function isPersonaTone(value: string): value is PersonaTone {
  return VALID_TONES.has(value);
}

export const PERSONA_TONE_LABELS: Record<PersonaTone, string> = {
  professional: "Profesional",
  casual: "Casual",
  formal: "Formal",
};
