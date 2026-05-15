/**
 * Agent store — ephemeral streaming-response state.
 *
 * The agent has FIVE mutually-exclusive lifecycle phases, driven by WS
 * events from the backend ("cognitive duplex" indicator):
 *
 *   idle       — nothing is happening (initial, post-commit, post-reset).
 *   listening  — interim (non-final) transcripts are arriving from STT.
 *                Backend emits {"type":"listening"} once per turn (debounced).
 *   unclear    — final transcript arrived but Deepgram confidence was
 *                below the scenario threshold. The LLM was NOT called.
 *                Backend emits {"type":"unclear"} and the UI prompts the
 *                user to repeat. Auto-resets to idle after 5s if no new
 *                event arrives (see use-live-session.ts).
 *   thinking   — final transcript received, LLM has been triggered, no
 *                tokens yet. Backend emits {"type":"thinking","text":""}.
 *   responding — first LLM token has arrived; tokens are streaming.
 *                Backend emits {"type":"responding"} on the first token.
 *
 *   currentResponse — the in-flight token-by-token text. Cleared on
 *                     `cancelled` and on commit.
 *   responses — committed history (last N agent answers in this session).
 *
 * Hints persisted by the backend live in the SessionStore (`hints`); this
 * store only mirrors what the agent is *currently* saying.
 *
 * BACKWARD-COMPAT: existing consumers read `isThinking`. We expose a
 * selector helper `selectIsThinking` (and friends) so callers don't poke
 * the raw `phase` field directly. The legacy `setThinking` setter is
 * retained as a synonym for `setPhase("thinking" | "idle")` so the
 * AgentEvent handler in `use-live-session.ts` keeps compiling — but new
 * code SHOULD prefer `setPhase` directly.
 */

import { create } from "zustand";

export type AgentPhase =
  | "idle"
  | "listening"
  | "unclear"
  | "thinking"
  | "responding";

interface AgentResponseEntry {
  text: string;
  ms: number;
}

interface AgentStoreState {
  phase: AgentPhase;
  /**
   * Legacy mirror of `phase === "thinking"`. Retained so callers that
   * still read `useAgentStore((s) => s.isThinking)` keep working without
   * a churn. New code: use the `selectIsThinking` selector instead.
   */
  isThinking: boolean;
  currentResponse: string;
  responses: AgentResponseEntry[];

  setPhase(p: AgentPhase): void;
  /** Legacy setter — flips phase to "thinking" (on) or "idle" (off). */
  setThinking(v: boolean): void;
  appendChunk(chunk: string): void;
  setCurrent(text: string): void;
  commitCurrent(ms?: number): void;
  clearCurrent(): void;
  reset(): void;
}

// ----------------------------------------------------------------------
// Selectors — preferred read API. Keep these stable references so Zustand
// shallow-equality doesn't trigger re-renders unnecessarily.
// ----------------------------------------------------------------------

export const selectPhase = (s: AgentStoreState): AgentPhase => s.phase;
export const selectIsIdle = (s: AgentStoreState): boolean =>
  s.phase === "idle";
export const selectIsListening = (s: AgentStoreState): boolean =>
  s.phase === "listening";
export const selectIsUnclear = (s: AgentStoreState): boolean =>
  s.phase === "unclear";
export const selectIsThinking = (s: AgentStoreState): boolean =>
  s.phase === "thinking";
export const selectIsResponding = (s: AgentStoreState): boolean =>
  s.phase === "responding";

export const useAgentStore = create<AgentStoreState>((set) => ({
  phase: "idle",
  isThinking: false,
  currentResponse: "",
  responses: [],

  setPhase: (p) => set({ phase: p, isThinking: p === "thinking" }),

  setThinking: (v) =>
    set({
      phase: v ? "thinking" : "idle",
      isThinking: v,
    }),

  appendChunk: (chunk) =>
    set((state) => ({
      currentResponse: state.currentResponse + chunk,
      // First token transitions thinking → responding. Subsequent tokens
      // keep us in "responding". If we somehow appended a chunk while
      // idle/listening (out-of-order WS), force responding so the UI
      // doesn't lie.
      phase: "responding",
      isThinking: false,
    })),

  setCurrent: (text) =>
    set({
      currentResponse: text,
      phase: "thinking",
      isThinking: true,
    }),

  commitCurrent: (ms = 0) =>
    set((state) => {
      const text = state.currentResponse.trim();
      if (!text) {
        return { currentResponse: "", phase: "idle", isThinking: false };
      }
      return {
        currentResponse: "",
        phase: "idle",
        isThinking: false,
        responses: [...state.responses, { text, ms }],
      };
    }),

  clearCurrent: () =>
    set({ currentResponse: "", phase: "idle", isThinking: false }),

  reset: () =>
    set({
      phase: "idle",
      isThinking: false,
      currentResponse: "",
      responses: [],
    }),
}));
