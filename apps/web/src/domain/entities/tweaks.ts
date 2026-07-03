/**
 * Tweaks — runtime-switchable visual modes for the live screen.
 *
 *   layout         — global layout: standalone (default), pip, sidebar.
 *   hintStyle      — how agent hints render: cards / chat / sidebar.
 *   transcriptStyle — how transcripts render: chat / doc / karaoke.
 *   pipOpacity     — PiP overlay outer-container opacity (0.3 .. 1.0).
 *   isHidden       — global peek-dim flag. When true the PiP / Sidebar
 *                    layouts render at very low opacity. Toggled via the
 *                    Cmd+Shift+H global hotkey (use-global-hotkeys).
 *   pipMode        — "expanded" shows transcripts + hints + meter,
 *                    "compact" shows only the latest hint + phase chip.
 *   pipTheme       — "auto" (matches OS), "dark" (solid dark surface),
 *                    "transparent" (rgba bg + backdrop-filter blur).
 *
 * Persistence: each axis writes to localStorage so the user's choice
 * survives reloads. SSR-safe access is the responsibility of the store
 * (see `application/stores/tweaks.store.ts`).
 */

export type LayoutMode = "standalone" | "pip" | "sidebar";
export type HintStyle = "cards" | "chat" | "sidebar";
export type TranscriptStyle = "chat" | "doc" | "karaoke";
export type PipMode = "expanded" | "compact";
export type PipTheme = "auto" | "dark" | "transparent";

export interface TweaksState {
  layout: LayoutMode;
  hintStyle: HintStyle;
  transcriptStyle: TranscriptStyle;
  pipOpacity: number;
  isHidden: boolean;
  pipMode: PipMode;
  pipTheme: PipTheme;
  /**
   * Show the live conversation-metrics card (talk ratio / WPM /
   * monologue alert) inside Sidebar layout. Default ON because the
   * metrics actively help self-correct during interviews. Users who
   * prefer zen mode (no on-screen analytics) can turn this off from
   * the Tweaks panel; their choice persists across reloads.
   */
  showConversationMetrics: boolean;
}

export const LAYOUT_MODES: readonly LayoutMode[] = [
  "standalone",
  "pip",
  "sidebar",
];
export const HINT_STYLES: readonly HintStyle[] = ["cards", "chat", "sidebar"];
export const TRANSCRIPT_STYLES: readonly TranscriptStyle[] = [
  "chat",
  "doc",
  "karaoke",
];
export const PIP_MODES: readonly PipMode[] = ["expanded", "compact"];
export const PIP_THEMES: readonly PipTheme[] = ["auto", "dark", "transparent"];

/** Bounds for the PiP opacity slider. */
export const PIP_OPACITY_MIN = 0.3;
export const PIP_OPACITY_MAX = 1.0;
export const PIP_OPACITY_STEP = 0.05;
export const PIP_OPACITY_DEFAULT = 1.0;

/**
 * Clamp + sanitise an arbitrary number into the PiP opacity range. Used by
 * the store hydrator (defensive — localStorage strings can be tampered with)
 * and by `setPipOpacity` so the slider never escapes the [min, max] window.
 */
export function clampPipOpacity(value: number): number {
  if (!Number.isFinite(value)) return PIP_OPACITY_DEFAULT;
  if (value < PIP_OPACITY_MIN) return PIP_OPACITY_MIN;
  if (value > PIP_OPACITY_MAX) return PIP_OPACITY_MAX;
  return value;
}
