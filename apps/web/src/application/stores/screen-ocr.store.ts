import { create } from "zustand";

/**
 * Screen OCR store — keeps a small ring buffer of recent OCR extractions
 * from the user's shared screen. Used by:
 *   - TweaksPanel toggle (enabled flag)
 *   - useScreenOcr hook (writes via push, calls sink on new entries)
 *   - SidebarLayout debug panel (reads `entries`)
 *   - useLiveSession (registers a `sink` that forwards to the backend
 *     via AgentStreamPort.sendScreenText — G2)
 *
 * MediaStream and OCR worker state lives in the hook — only plain JSON
 * (and the function pointer for `sink`) survives here, which keeps the
 * store predictable and zustand-DevTools friendly.
 */
export interface ScreenOcrEntry {
  text: string;
  confidence: number;
  capturedAt: number; // epoch ms
}

/**
 * G2 — function the OCR hook calls on every NEW valid extraction. The
 * live-session hook installs it on `start()` (pointing at
 * `agentStreamRef.current.sendScreenText`) and clears it on `stop()` /
 * unmount so OCR pushes outside a capture window are silently dropped.
 *
 * Confidence + non-empty gating happens HERE (in the hook) rather than
 * at the adapter so the wire footprint stays minimal — the backend
 * also enforces a confidence floor, but pre-filtering on the client
 * avoids paying the WS round-trip for unusable extractions.
 */
export type ScreenTextSink = (entry: ScreenOcrEntry) => void;

interface ScreenOcrState {
  enabled: boolean;
  entries: ScreenOcrEntry[]; // last N (capped at MAX_ENTRIES)
  latest: ScreenOcrEntry | null;
  sink: ScreenTextSink | null;
  setEnabled: (v: boolean) => void;
  push: (entry: ScreenOcrEntry) => void;
  setSink: (sink: ScreenTextSink | null) => void;
  clear: () => void;
}

const MAX_ENTRIES = 5;

export const useScreenOcrStore = create<ScreenOcrState>((set) => ({
  enabled: false,
  entries: [],
  latest: null,
  sink: null,
  setEnabled: (v) => set({ enabled: v }),
  push: (entry) =>
    set((s) => {
      const next = [entry, ...s.entries].slice(0, MAX_ENTRIES);
      return { entries: next, latest: entry };
    }),
  setSink: (sink) => set({ sink }),
  clear: () => set({ entries: [], latest: null }),
}));
