/**
 * Tweaks store — persistent UI mode selectors for the live screen.
 *
 * Each axis (layout, hintStyle, transcriptStyle, pipOpacity, pipMode,
 * pipTheme) is mirrored in localStorage under its own key so the user's
 * choice survives reloads and cross-tab consistency is easy
 * (BroadcastChannel reuse in F5).
 *
 * Persistence scope (Cluely-parity quick wins): we ONLY persist long-term
 * preferences — layout/transcriptStyle/hintStyle/pipOpacity/pipMode/pipTheme.
 * The `isHidden` peek-dim flag is intentionally NOT persisted: it's a
 * transient session state driven by the Cmd+Shift+H hotkey and resetting
 * to "visible" on reload is the safer UX (so a closed laptop doesn't come
 * back invisible).
 *
 * SSR safety: the initial value reader runs only when the store is first
 * read; `typeof window` check prevents Node from blowing up. Next.js
 * client components hydrate after mount so the visible state matches the
 * persisted choice.
 */

import { create } from "zustand";
import type {
  HintStyle,
  LayoutMode,
  PipMode,
  PipTheme,
  TranscriptStyle,
  TweaksState,
} from "@/domain/entities/tweaks";
import {
  HINT_STYLES,
  LAYOUT_MODES,
  PIP_MODES,
  PIP_OPACITY_DEFAULT,
  PIP_THEMES,
  TRANSCRIPT_STYLES,
  clampPipOpacity,
} from "@/domain/entities/tweaks";

const LAYOUT_KEY = "susurra-layout";
const HINT_KEY = "susurra-hint-style";
const TRANSCRIPT_KEY = "susurra-transcript-style";
const PIP_OPACITY_KEY = "susurra-pip-opacity";
const PIP_MODE_KEY = "susurra-pip-mode";
const PIP_THEME_KEY = "susurra-pip-theme";
const SHOW_METRICS_KEY = "susurra-show-conversation-metrics";

function readStored<T extends string>(
  key: string,
  allowed: readonly T[],
  fallback: T,
): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v && (allowed as readonly string[]).includes(v)) return v as T;
  } catch {
    // localStorage may throw in private mode — fall back silently.
  }
  return fallback;
}

function readStoredBoolean(key: string, fallback: boolean): boolean {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return fallback;
    if (v === "true") return true;
    if (v === "false") return false;
    return fallback;
  } catch {
    return fallback;
  }
}

function readStoredNumber(key: string, fallback: number): number {
  if (typeof window === "undefined") return fallback;
  try {
    const v = window.localStorage.getItem(key);
    if (v === null) return fallback;
    const n = Number.parseFloat(v);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // ignore quota/private-mode failures — in-memory state still works.
  }
}

interface TweaksStoreState extends TweaksState {
  setLayout(layout: LayoutMode): void;
  setHintStyle(style: HintStyle): void;
  setTranscriptStyle(style: TranscriptStyle): void;
  setPipOpacity(value: number): void;
  toggleHidden(): void;
  setHidden(value: boolean): void;
  setPipMode(mode: PipMode): void;
  setPipTheme(theme: PipTheme): void;
  setShowConversationMetrics(value: boolean): void;
}

export const useTweaksStore = create<TweaksStoreState>((set) => ({
  layout: readStored<LayoutMode>(LAYOUT_KEY, LAYOUT_MODES, "standalone"),
  hintStyle: readStored<HintStyle>(HINT_KEY, HINT_STYLES, "cards"),
  // Default to karaoke — large subtitle-style UX is the preferred experience
  // for new users (especially during interviews / meetings). Free-tier users
  // who only unlock `chat` are auto-downgraded by a tier-aware effect on the
  // /app/live page (see `TweaksPanel.tsx` use-tier-gate fallback).
  transcriptStyle: readStored<TranscriptStyle>(
    TRANSCRIPT_KEY,
    TRANSCRIPT_STYLES,
    "karaoke",
  ),
  pipOpacity: clampPipOpacity(
    readStoredNumber(PIP_OPACITY_KEY, PIP_OPACITY_DEFAULT),
  ),
  // Transient: never persisted. Always starts visible on a fresh page load
  // so the user isn't stuck with a near-invisible overlay after a reload.
  isHidden: false,
  pipMode: readStored<PipMode>(PIP_MODE_KEY, PIP_MODES, "expanded"),
  pipTheme: readStored<PipTheme>(PIP_THEME_KEY, PIP_THEMES, "auto"),
  // Conversation metrics default ON — they help, and we'd rather make
  // sure users discover the feature than hide it behind a flag.
  showConversationMetrics: readStoredBoolean(SHOW_METRICS_KEY, true),
  setLayout: (layout) => {
    writeStored(LAYOUT_KEY, layout);
    set({ layout });
  },
  setHintStyle: (hintStyle) => {
    writeStored(HINT_KEY, hintStyle);
    set({ hintStyle });
  },
  setTranscriptStyle: (transcriptStyle) => {
    writeStored(TRANSCRIPT_KEY, transcriptStyle);
    set({ transcriptStyle });
  },
  setPipOpacity: (value) => {
    const clamped = clampPipOpacity(value);
    writeStored(PIP_OPACITY_KEY, String(clamped));
    set({ pipOpacity: clamped });
  },
  toggleHidden: () => {
    set((s) => ({ isHidden: !s.isHidden }));
  },
  setHidden: (value) => {
    set({ isHidden: value });
  },
  setPipMode: (pipMode) => {
    writeStored(PIP_MODE_KEY, pipMode);
    set({ pipMode });
  },
  setPipTheme: (pipTheme) => {
    writeStored(PIP_THEME_KEY, pipTheme);
    set({ pipTheme });
  },
  setShowConversationMetrics: (value) => {
    writeStored(SHOW_METRICS_KEY, String(value));
    set({ showConversationMetrics: value });
  },
}));
