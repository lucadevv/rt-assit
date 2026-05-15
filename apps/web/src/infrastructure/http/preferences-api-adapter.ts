/**
 * PreferencesApiAdapter — concrete `PreferencesApiPort` implementation.
 *
 * Backend reference (python_backend/app/presentation/api/me_router.py):
 *  - GET   /api/preferences  → UserPreferencesResponse
 *  - PATCH /api/preferences  → UserPreferencesResponse (partial body)
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping (application stays clean).
 *  - Forward explicit `null` for `audio_device_id` /
 *    `auto_delete_recordings_days` so the backend's
 *    `model_fields_set` check distinguishes "unchanged" from "reset".
 *  - Defensive normalisation: backend may evolve enum values; we
 *    pass them through as-is and let the domain types narrow them.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type { PreferencesApiPort } from "@/application/ports/preferences-api.port";
import type {
  DensityMode,
  HintStyle,
  LayoutMode,
  ThemeMode,
  TranscriptStyle,
  UpdateUserPreferences,
  UserPreferences,
} from "@/domain/entities/user-preferences";

interface UserPreferencesRaw {
  user_id: string;
  theme: string;
  density: string;
  default_layout: string;
  default_hint_style: string;
  default_transcript_style: string;
  default_scenario: string;
  auto_delete_recordings_days: number | null;
  keyboard_shortcuts: Record<string, unknown> | null;
  audio_device_id: string | null;
  updated_at: string | null;
}

const VALID_THEMES: readonly ThemeMode[] = ["light", "dark", "system"];
const VALID_DENSITIES: readonly DensityMode[] = ["comfortable", "compact"];
const VALID_LAYOUTS: readonly LayoutMode[] = ["standalone", "pip", "sidebar"];
const VALID_HINTS: readonly HintStyle[] = ["cards", "chat", "sidebar"];
const VALID_TRANSCRIPTS: readonly TranscriptStyle[] = [
  "chat",
  "doc",
  "karaoke",
];

function asTheme(raw: string): ThemeMode {
  return (VALID_THEMES as readonly string[]).includes(raw)
    ? (raw as ThemeMode)
    : "system";
}

function asDensity(raw: string): DensityMode {
  return (VALID_DENSITIES as readonly string[]).includes(raw)
    ? (raw as DensityMode)
    : "comfortable";
}

function asLayout(raw: string): LayoutMode {
  return (VALID_LAYOUTS as readonly string[]).includes(raw)
    ? (raw as LayoutMode)
    : "standalone";
}

function asHint(raw: string): HintStyle {
  return (VALID_HINTS as readonly string[]).includes(raw)
    ? (raw as HintStyle)
    : "cards";
}

function asTranscript(raw: string): TranscriptStyle {
  return (VALID_TRANSCRIPTS as readonly string[]).includes(raw)
    ? (raw as TranscriptStyle)
    : "chat";
}

function normaliseShortcuts(
  raw: Record<string, unknown> | null,
): Record<string, string> {
  if (!raw) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function map(raw: UserPreferencesRaw): UserPreferences {
  return {
    userId: raw.user_id,
    theme: asTheme(raw.theme),
    density: asDensity(raw.density),
    defaultLayout: asLayout(raw.default_layout),
    defaultHintStyle: asHint(raw.default_hint_style),
    defaultTranscriptStyle: asTranscript(raw.default_transcript_style),
    defaultScenario: raw.default_scenario,
    autoDeleteRecordingsDays: raw.auto_delete_recordings_days,
    audioDeviceId: raw.audio_device_id,
    keyboardShortcuts: normaliseShortcuts(raw.keyboard_shortcuts),
    updatedAt: raw.updated_at,
  };
}

export class PreferencesApiAdapter implements PreferencesApiPort {
  constructor(private readonly api: ApiClient) {}

  async get(): Promise<UserPreferences> {
    const raw = await this.api.get<UserPreferencesRaw>("/api/preferences");
    return map(raw);
  }

  async update(req: UpdateUserPreferences): Promise<UserPreferences> {
    const body: Record<string, unknown> = {};
    if (req.theme !== undefined) body["theme"] = req.theme;
    if (req.density !== undefined) body["density"] = req.density;
    if (req.defaultLayout !== undefined) body["default_layout"] = req.defaultLayout;
    if (req.defaultHintStyle !== undefined)
      body["default_hint_style"] = req.defaultHintStyle;
    if (req.defaultTranscriptStyle !== undefined)
      body["default_transcript_style"] = req.defaultTranscriptStyle;
    if (req.defaultScenario !== undefined)
      body["default_scenario"] = req.defaultScenario;
    if (req.autoDeleteRecordingsDays !== undefined)
      body["auto_delete_recordings_days"] = req.autoDeleteRecordingsDays;
    // audioDeviceId admits explicit null reset — forward as-is when the
    // caller set the key (undefined means "leave unchanged").
    if (req.audioDeviceId !== undefined)
      body["audio_device_id"] = req.audioDeviceId;
    if (req.keyboardShortcuts !== undefined)
      body["keyboard_shortcuts"] = req.keyboardShortcuts;

    const raw = await this.api.patch<UserPreferencesRaw>(
      "/api/preferences",
      body,
    );
    return map(raw);
  }
}

export const __testing = { map };
