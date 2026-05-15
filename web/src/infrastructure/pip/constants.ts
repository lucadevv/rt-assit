/**
 * PiP overlay constants — single source of truth for the broadcast channel
 * name and the snapshot/message shapes shared between the host page and the
 * PiP window.
 *
 * Note (F5): we do NOT use BroadcastChannel for action dispatch in the
 * default flow because BroadcastChannel does not echo same-tab messages back
 * to the sender. Action dispatch happens via React closures (the React tree
 * inside the PiP window is rendered from the host hook, so its closures
 * already reach the parent stores). The channel name is exported anyway so
 * future read-only viewers (e.g., shared link) can listen to overlay state
 * without hard-coding the string.
 */

import type { ScenarioColor } from "@/domain/entities/scenario";

export const OVERLAY_CHANNEL = "susurra-pip-overlay";

export interface OverlayTranscriptSnapshot {
  content: string;
  speakerLabel: string | null;
  isFinal: boolean;
}

export interface OverlaySnapshot {
  isLive: boolean;
  scenarioColor: ScenarioColor;
  scenarioLabel: string | null;
  transcript: OverlayTranscriptSnapshot | null;
  currentResponse: string;
  lastResponse: string;
  isThinking: boolean;
  durationSeconds: number;
}

export type OverlayMessage =
  | { kind: "state"; snapshot: OverlaySnapshot }
  | { kind: "ready" }
  | { kind: "request_start" }
  | { kind: "request_stop" };
