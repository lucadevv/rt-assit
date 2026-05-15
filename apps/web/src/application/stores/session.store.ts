/**
 * Session store — owns the live session domain state shown on /app/live.
 *
 * Layout:
 *   - `session`: current session row (may be null before "Iniciar captura").
 *   - `transcripts`: committed (final) lines, in chronological order.
 *   - `interim`: in-flight non-final transcript (single slot — replaces
 *     itself as Deepgram refines the partial).
 *   - `hints`: agent hints persisted by the backend.
 *   - `speakers`: keyed by deepgramSpeakerId for fast updates from WS
 *     events (`speaker_label_updated` / `speakers_merged`).
 *
 * Interim → final commit rules (see pushTranscript):
 *   1. !isFinal               → set as interim (replace).
 *   2. isFinal, no interim    → push as final.
 *   3. isFinal + interim same speaker → drop interim (the final supersedes).
 *   4. isFinal + interim diff speaker → commit interim as final, then push
 *      this final (handles speaker switch mid-utterance).
 *
 * No infrastructure imports. Pure domain state + actions.
 */

import { create } from "zustand";
import type { Session } from "@/domain/entities/session";
import type { Transcript } from "@/domain/entities/transcript";
import type { Hint } from "@/domain/entities/hint";
import type { Speaker } from "@/domain/entities/speaker";

interface SessionStoreState {
  session: Session | null;
  transcripts: Transcript[];
  interim: Transcript | null;
  hints: Hint[];
  speakers: Map<number, Speaker>;
  isCapturing: boolean;
  isPaused: boolean;
  framesSent: number;
  bytesSent: number;
  durationSeconds: number;
  /**
   * Live MediaStream emitted by the capture adapter via `onStream`.
   *
   * Lives in the store (not local component state) so any subscriber
   * (e.g. SidebarLayout) can reactively pick it up regardless of whether
   * the component was mounted BEFORE or AFTER capture began. NEVER
   * persisted — MediaStream is non-serializable.
   */
  currentStream: MediaStream | null;

  // Actions
  setSession(session: Session | null): void;
  setSessionDetail(input: {
    session: Session;
    transcripts: Transcript[];
    hints: Hint[];
    speakers: Speaker[];
  }): void;
  pushTranscript(t: Transcript): void;
  pushHint(h: Hint): void;
  upsertSpeaker(s: Speaker): void;
  setSpeakers(list: Speaker[]): void;
  setIsCapturing(v: boolean): void;
  setPaused(paused: boolean): void;
  setCurrentStream(stream: MediaStream | null): void;
  recordFrame(frames: number, bytes: number): void;
  tickDuration(): void;
  reset(): void;
}

function speakerKey(t: Transcript): number | null {
  return t.deepgramSpeaker ?? t.speakerId ?? null;
}

export const useSessionStore = create<SessionStoreState>((set) => ({
  session: null,
  transcripts: [],
  interim: null,
  hints: [],
  speakers: new Map<number, Speaker>(),
  isCapturing: false,
  isPaused: false,
  framesSent: 0,
  bytesSent: 0,
  durationSeconds: 0,
  currentStream: null,

  setSession: (session) => set({ session }),

  setSessionDetail: ({ session, transcripts, hints, speakers }) => {
    const map = new Map<number, Speaker>();
    for (const s of speakers) {
      map.set(s.deepgramSpeakerId, s);
    }
    set({
      session,
      transcripts,
      hints,
      speakers: map,
      interim: null,
      durationSeconds: session.durationSeconds ?? 0,
    });
  },

  pushTranscript: (t) =>
    set((state) => {
      // Non-final: replace interim slot.
      if (!t.isFinal) {
        return { interim: t };
      }
      // Final: maybe commit pending interim if speaker changed.
      const interim = state.interim;
      const transcripts = state.transcripts.slice();
      if (interim) {
        const sameSpeaker = speakerKey(interim) === speakerKey(t);
        if (!sameSpeaker) {
          // Promote the abandoned interim line to final so we don't lose it.
          transcripts.push({ ...interim, isFinal: true });
        }
      }
      transcripts.push(t);
      return { transcripts, interim: null };
    }),

  pushHint: (h) =>
    set((state) => {
      // Dedupe by id when present (server-confirmed hint may arrive twice).
      if (h.id != null && state.hints.some((existing) => existing.id === h.id)) {
        return state;
      }
      return { hints: [...state.hints, h] };
    }),

  upsertSpeaker: (s) =>
    set((state) => {
      const next = new Map(state.speakers);
      next.set(s.deepgramSpeakerId, s);
      return { speakers: next };
    }),

  setSpeakers: (list) =>
    set(() => {
      const next = new Map<number, Speaker>();
      for (const s of list) {
        next.set(s.deepgramSpeakerId, s);
      }
      return { speakers: next };
    }),

  setIsCapturing: (v) =>
    set((state) => ({
      isCapturing: v,
      // Always clear the paused flag when the capture (re)starts or stops.
      isPaused: v ? state.isPaused : false,
      // Stream lives only while capturing — clear it on stop so consumers
      // fall back to the idle placeholder.
      currentStream: v ? state.currentStream : null,
    })),

  setPaused: (paused) => set({ isPaused: paused }),

  setCurrentStream: (stream) => set({ currentStream: stream }),

  recordFrame: (frames, bytes) => set({ framesSent: frames, bytesSent: bytes }),

  tickDuration: () =>
    set((state) => ({ durationSeconds: state.durationSeconds + 1 })),

  reset: () =>
    set({
      session: null,
      transcripts: [],
      interim: null,
      hints: [],
      speakers: new Map<number, Speaker>(),
      isCapturing: false,
      isPaused: false,
      framesSent: 0,
      bytesSent: 0,
      durationSeconds: 0,
      currentStream: null,
    }),
}));
