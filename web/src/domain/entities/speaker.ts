/**
 * Speaker domain entity — backend `SpeakerResponse` mirror (B3).
 *
 * Identity model:
 *   - `id` (positive integer) — backend PK. Assigned once the speaker is
 *     auto-registered by the WS pipeline.
 *   - `deepgramSpeakerId` — the raw 0/1/2... cluster id from Deepgram.
 *     Stable within a session; we key the live store by this value so
 *     we can render labels even before the backend has assigned a `id`.
 *
 * `colorHint` is one of the four Auri scenario colors (cyan / amber /
 * lavender / lime). The frontend resolves the semantic color name to
 * actual OKLCH via `design-system/tokens/colors.ts`.
 */

import type { ScenarioColor } from "./scenario";

export interface Speaker {
  id: number;
  sessionId: string;
  deepgramSpeakerId: number;
  label: string | null;
  isUser: boolean;
  colorHint: ScenarioColor;
}
