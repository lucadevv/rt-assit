/**
 * UserPreferences — TypeScript mirror of the backend
 * `app/domain/entities/user_preferences.py` entity exposed via
 * GET/PATCH /api/preferences.
 *
 * Backend contract (snake_case JSON, see UserPreferencesResponse):
 *
 *   {
 *     user_id: string,
 *     theme: "light" | "dark" | "system",
 *     density: "comfortable" | "compact",
 *     default_layout: "standalone" | "pip" | "sidebar",
 *     default_hint_style: "cards" | "chat" | "sidebar",
 *     default_transcript_style: "chat" | "doc" | "karaoke",
 *     default_scenario: string,
 *     auto_delete_recordings_days: number | null,
 *     keyboard_shortcuts: Record<string, unknown>,
 *     audio_device_id: string | null,
 *     updated_at: string | null
 *   }
 *
 * The frontend keeps camelCase + ISO strings only — mapping happens at the
 * adapter boundary (`infrastructure/http/preferences-api-adapter.ts`).
 *
 * Layout / HintStyle / TranscriptStyle types are imported from `tweaks.ts`
 * to avoid duplication (single source of truth across F2 + F6).
 */

import type {
  HintStyle,
  LayoutMode,
  TranscriptStyle,
} from "@/domain/entities/tweaks";

export type ThemeMode = "light" | "dark" | "system";
export type DensityMode = "comfortable" | "compact";

export type { HintStyle, LayoutMode, TranscriptStyle };

export interface UserPreferences {
  userId: string;
  theme: ThemeMode;
  density: DensityMode;
  defaultLayout: LayoutMode;
  defaultHintStyle: HintStyle;
  defaultTranscriptStyle: TranscriptStyle;
  defaultScenario: string;
  autoDeleteRecordingsDays: number | null;
  audioDeviceId: string | null;
  keyboardShortcuts: Record<string, string>;
  updatedAt: string | null;
}

/**
 * UpdateUserPreferences — partial-patch shape for PATCH /api/preferences.
 *
 * Every field is optional. `audioDeviceId` and `autoDeleteRecordingsDays`
 * accept explicit `null` to reset (translates to JSON `null` on the wire,
 * which the backend distinguishes from "missing" via `model_fields_set`).
 */
export interface UpdateUserPreferences {
  theme?: ThemeMode;
  density?: DensityMode;
  defaultLayout?: LayoutMode;
  defaultHintStyle?: HintStyle;
  defaultTranscriptStyle?: TranscriptStyle;
  defaultScenario?: string;
  autoDeleteRecordingsDays?: number | null;
  audioDeviceId?: string | null;
  keyboardShortcuts?: Record<string, string>;
}

export const VALID_THEMES: readonly ThemeMode[] = ["light", "dark", "system"];
export const VALID_DENSITIES: readonly DensityMode[] = [
  "comfortable",
  "compact",
];

/**
 * Auto-delete recordings options surfaced in the Settings UI. `null` maps
 * to "Nunca" (never auto-delete).
 */
export const AUTO_DELETE_OPTIONS: readonly { value: number | null; label: string }[] =
  [
    { value: null, label: "Nunca" },
    { value: 7, label: "7 días" },
    { value: 30, label: "30 días" },
    { value: 90, label: "90 días" },
    { value: 365, label: "365 días" },
  ];
