"use client";

/**
 * useLiveSession — orchestrator hook for the /app/live screen.
 *
 * Responsibilities:
 *   1. On mount, hydrate the session store from the URL `?sessionId=`
 *      (canonical channel) OR fall back to RecoverActiveSession (FR-22).
 *      Once that first attempt completes (success or fail), the hook
 *      flips `hydrationFinished` so the page can render the right state
 *      (live layout vs friendly empty state) without flicker.
 *   2. `start()`: connect WS clients (audio uplink, transcripts overlay,
 *      backend agent) → start audio capture. Reads the session from the
 *      store — it NEVER creates a session. The only path to create one
 *      is `<NewSessionModal />`. If no session is hydrated when `start()`
 *      fires, it errors out with a Spanish message.
 *   3. `stop()`: stop audio capture → close WS clients → end session
 *      via REST.
 *   4. Bind transcript & agent events to the session/agent stores.
 *   5. Drive the duration timer (1s tick).
 *
 * Single-path invariant (architecture/single-path-session-creation):
 *   The Modal Nueva Sesión is the ONLY surface allowed to POST a session.
 *   `useLiveSession.start()` is purely a "connect to the session that
 *   already exists in the store" operation. This eliminates the
 *   duplicate-session bug where bare /app/live mounts (or post-modal
 *   `router.replace` race conditions) caused a second POST.
 *
 * The hook holds NO React state for ports (refs only) so a re-render
 * doesn't tear down WS connections. Stores are the source of truth for
 * UI state.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useSessionStore } from "@/application/stores/session.store";
import { useAgentStore } from "@/application/stores/agent.store";
import { useAuthStore } from "@/application/stores/auth.store";
import { useScreenOcrStore } from "@/application/stores/screen-ocr.store";
import type { AudioUplinkPort } from "@/application/ports/audio-uplink.port";
import type { AgentStreamPort, AgentEvent } from "@/application/ports/agent-stream.port";
import type { AgentPhase } from "@/application/stores/agent.store";
import type { TranscriptStreamMessage } from "@/application/ports/transcripts-stream.port";
import type { Transcript } from "@/domain/entities/transcript";
import type { Hint } from "@/domain/entities/hint";
import type { Speaker } from "@/domain/entities/speaker";
import { scenarioColorOf } from "@/domain/entities/scenario";

export interface UseLiveSessionInput {
  /**
   * Pre-existing session id read from `?sessionId=` in /app/live. When
   * provided, the hook loads the session detail into the store on mount
   * (so the user sees the right session before clicking "Iniciar
   * captura") and the FR-22 recovery effect stands down — the URL is
   * canonical. When omitted, recovery runs as usual.
   */
  sessionIdFromUrl?: string | null;
}

interface UseLiveSessionResult {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isCapturing: boolean;
  isStarting: boolean;
  isStopping: boolean;
  error: string | null;
  framesSent: number;
  bytesSent: number;
  durationSeconds: number;
  /**
   * Flips `true` once the mount hydration effect completes its first
   * attempt (URL hydrate or recovery, success or fail). The /app/live
   * page reads this to decide between rendering the live layout and the
   * friendly empty state — without it the empty state would flash
   * during SSR/hydration.
   */
  hydrationFinished: boolean;
}

export function useLiveSession(
  input?: UseLiveSessionInput,
): UseLiveSessionResult {
  const sessionIdFromUrl =
    typeof input?.sessionIdFromUrl === "string" &&
    input.sessionIdFromUrl.length > 0
      ? input.sessionIdFromUrl
      : null;

  const {
    audioCapture,
    audioUplinkFactory,
    transcriptsStream,
    agentStreamFactory,
    endSession,
    recoverActiveSession,
    getSessionDetail,
    analytics,
  } = useContainer();

  // [susurra/diag] mount id for tracing this hook instance across logs.
  const mountIdRef = useRef<string>("");
  if (!mountIdRef.current) {
    mountIdRef.current = Math.random().toString(36).slice(2, 8);
    // eslint-disable-next-line no-console
    console.info(`[susurra/diag] useLiveSession MOUNT id=${mountIdRef.current}`);
  }

  const session = useSessionStore((s) => s.session);
  const isCapturing = useSessionStore((s) => s.isCapturing);
  const framesSent = useSessionStore((s) => s.framesSent);
  const bytesSent = useSessionStore((s) => s.bytesSent);
  const durationSeconds = useSessionStore((s) => s.durationSeconds);

  // Action selectors (stable references — Zustand returns the same fn).
  const setSession = useSessionStore((s) => s.setSession);
  const setSessionDetail = useSessionStore((s) => s.setSessionDetail);
  const pushTranscript = useSessionStore((s) => s.pushTranscript);
  const pushHint = useSessionStore((s) => s.pushHint);
  const upsertSpeaker = useSessionStore((s) => s.upsertSpeaker);
  const setSpeakers = useSessionStore((s) => s.setSpeakers);
  const setIsCapturing = useSessionStore((s) => s.setIsCapturing);
  const setCurrentStream = useSessionStore((s) => s.setCurrentStream);
  const recordFrame = useSessionStore((s) => s.recordFrame);
  const tickDuration = useSessionStore((s) => s.tickDuration);

  const setPhase = useAgentStore((s) => s.setPhase);
  const appendChunk = useAgentStore((s) => s.appendChunk);
  const setCurrent = useAgentStore((s) => s.setCurrent);
  const commitCurrent = useAgentStore((s) => s.commitCurrent);
  const clearCurrent = useAgentStore((s) => s.clearCurrent);

  const user = useAuthStore((s) => s.user);

  // Mutable state held in refs so re-renders don't recreate connections.
  const audioUplinkRef = useRef<AudioUplinkPort | null>(null);
  const agentStreamRef = useRef<AgentStreamPort | null>(null);
  const transcriptsUnsubRef = useRef<(() => void) | null>(null);
  const agentUnsubRef = useRef<(() => void) | null>(null);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const errorRef = useRef<string | null>(null);

  // Fase E2 — auto-reset for the "unclear" phase. Backend emits the
  // event when a low-confidence final is gated; the UI shows "No te
  // escuché bien — repetí por favor". If the user says nothing for 5s,
  // we silently flip back to idle so the badge doesn't get stuck. Any
  // subsequent listening/thinking/responding event clears the timeout.
  const unclearTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // `hydrationFinished` flips true once the mount effect's first attempt
  // (URL hydrate OR recovery) settles — success or failure. Used by the
  // page to decide whether to show the live layout or the friendly
  // empty state. Held both in state (so React re-renders when it flips)
  // and in a ref (so the effect body can read the latest value without
  // re-running).
  const [hydrationFinished, setHydrationFinished] = useState(false);
  const hydrationFinishedRef = useRef(false);

  // ------------------------------------------------------------------
  // Mount hydration — URL-first, recovery-fallback.
  //
  // Priority order (Fase 1 fix):
  //   1. `sessionIdFromUrl` present  → load that exact session, ignore
  //      whatever the backend would have returned from `/sessions/active`.
  //      This makes the URL the canonical source of truth and prevents
  //      the recovery effect from rehydrating a stale orphan session
  //      that would later get finalised by mistake.
  //   2. No URL id  → FR-22 recovery: ask the backend for the latest
  //      `ended_at IS NULL` session and rehydrate it (legitimate
  //      "refresh during capture" case).
  //
  // Both branches set the session into the store via `setSessionDetail`
  // so the user sees the right session BEFORE clicking "Iniciar captura"
  // — the previous "user finalises a different session than the one
  // they created" bug came from this path being lazy.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    // Cross-session-leak guard (bugfix/cross-session-store-leak):
    // BEFORE we touch the network or hydrate the store, wipe the session
    // + agent state from any previous session that may still be sitting
    // in memory from an earlier mount. Without this, switching sessions
    // (e.g. interview_dev → meeting_business) inherits hints / responses
    // from the prior session because the previous mount only resets on
    // EndedState — not on a fresh session transition. The reset is
    // synchronous and the rest of this effect repopulates the stores
    // from the backend immediately after.
    useSessionStore.getState().reset();
    useAgentStore.getState().reset();

    const markFinished = (): void => {
      if (cancelled) return;
      if (hydrationFinishedRef.current) return;
      hydrationFinishedRef.current = true;
      setHydrationFinished(true);
    };

    const hydrateFromUrl = async (id: string): Promise<void> => {
      try {
        const detail = await getSessionDetail.execute(id);
        if (cancelled) return;
        setSessionDetail({
          session: detail.session,
          transcripts: detail.transcripts,
          hints: detail.hints,
          speakers: detail.speakers,
        });
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.warn("[susurra/live] url-hydrate failed", err);
      } finally {
        markFinished();
      }
    };

    const hydrateFromRecovery = async (): Promise<void> => {
      try {
        const active = await recoverActiveSession.execute();
        if (cancelled || !active) return;
        try {
          const detail = await getSessionDetail.execute(active.id);
          if (cancelled) return;
          setSessionDetail({
            session: detail.session,
            transcripts: detail.transcripts,
            hints: detail.hints,
            speakers: detail.speakers,
          });
        } catch (err: unknown) {
          // eslint-disable-next-line no-console
          console.warn("[susurra/live] recovery detail fetch failed", err);
          setSession(active);
        }
      } catch (err: unknown) {
        // eslint-disable-next-line no-console
        console.warn("[susurra/live] recover-active-session failed", err);
      } finally {
        markFinished();
      }
    };

    if (sessionIdFromUrl) {
      void hydrateFromUrl(sessionIdFromUrl);
    } else {
      void hydrateFromRecovery();
    }

    return () => {
      cancelled = true;
    };
  }, [
    user,
    sessionIdFromUrl,
    recoverActiveSession,
    getSessionDetail,
    setSession,
    setSessionDetail,
  ]);

  // ------------------------------------------------------------------
  // Duration timer — only ticks while we're actively capturing.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (!isCapturing) return;
    const id = setInterval(() => tickDuration(), 1000);
    return () => clearInterval(id);
  }, [isCapturing, tickDuration]);

  // ------------------------------------------------------------------
  // Global hotkey bridge — `susurra:force-regenerate` (Cmd+Shift+P).
  //
  // The `useGlobalHotkeys` hook (wired at the top of /app/live) dispatches
  // a CustomEvent on `window` when the user presses the chord. We listen
  // here because this hook owns the live-session context (last transcript,
  // analytics, capture state) and is the only consumer that has access to
  // the agent stream.
  //
  // Current behaviour (honest scope): the AgentStreamPort is receive-only
  // — there is no protocol frame to push a force-regenerate to the
  // backend graph. So we (a) look up the last final transcript from the
  // session store, (b) log a console hint with that text, and (c)
  // gracefully no-op when there is no transcript. When the backend gains
  // a regenerate frame, this is the single place to add the `send` call.
  // ------------------------------------------------------------------
  useEffect(() => {
    if (typeof window === "undefined") return;
    const handler = (): void => {
      const transcripts = useSessionStore.getState().transcripts;
      const lastFinal = [...transcripts]
        .reverse()
        .find((t) => t.isFinal);
      if (!lastFinal) {
        // No-op as specified — silently ignore.
        return;
      }
      // eslint-disable-next-line no-console
      console.info(
        "[susurra/live] force-regenerate requested",
        { transcript: lastFinal.content },
      );
    };
    window.addEventListener("susurra:force-regenerate", handler);
    return () => {
      window.removeEventListener("susurra:force-regenerate", handler);
    };
  }, []);

  // ------------------------------------------------------------------
  // Cleanup on unmount: drop sockets so navigating away doesn't leak.
  // ------------------------------------------------------------------
  useEffect(() => {
    return () => {
      // eslint-disable-next-line no-console
      console.warn(`[susurra/diag] useLiveSession UNMOUNT cleanup running id=${mountIdRef.current}`);
      // eslint-disable-next-line no-console
      console.warn(`[susurra/diag] isStartingRef=${isStartingRef.current} isCapturing=${useSessionStore.getState().isCapturing}`);
      transcriptsUnsubRef.current?.();
      agentUnsubRef.current?.();
      audioUplinkRef.current?.close();
      agentStreamRef.current?.close();
      // G2 — drop the OCR sink on unmount so a late extraction tick
      // (the hook lives one level up in the layout) can't try to send
      // through a closed socket reference.
      useScreenOcrStore.getState().setSink(null);
      void audioCapture.stop();
      // transcriptsStream is a singleton in the container; close it so
      // a fresh URL handshake happens next mount.
      transcriptsStream.close();
      // Fase E2 — clear any pending unclear-phase auto-reset timer so
      // it doesn't fire after unmount (would call setPhase on a stale
      // store consumer).
      if (unclearTimeoutRef.current !== null) {
        clearTimeout(unclearTimeoutRef.current);
        unclearTimeoutRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- container instances are stable per session
  }, []);

  // ------------------------------------------------------------------
  // start()
  //
  // Single-path invariant: this function NEVER creates a session row.
  // The Modal Nueva Sesión is the sole creation surface. `start()` reads
  // the session that the mount effect already hydrated into the store
  // and connects the live-time ports (audio uplink, agent stream,
  // transcripts stream, audio capture) against it.
  //
  // Pre-conditions checked here (each yields a Spanish errorRef):
  //   - user must be authenticated.
  //   - `useSessionStore.getState().session` must be non-null.
  //   - That session must still be `active` (not already ended).
  //
  // If any precondition fails we set `errorRef.current` and return —
  // the live page will read it via the hook's `error` field and surface
  // a friendly message.
  // ------------------------------------------------------------------
  const start = useCallback(async () => {
    // eslint-disable-next-line no-console
    console.info(
      `[susurra/diag] start() invoked mount=${mountIdRef.current} isStartingRef=${isStartingRef.current}`,
    );
    if (isStartingRef.current) return;
    if (!user) {
      errorRef.current = "Iniciá sesión antes de capturar.";
      return;
    }

    // The session MUST already exist in the store. The mount effect
    // hydrates it from the URL (modal happy path) or recovery (refresh
    // during capture). If neither path populated it, the page should
    // be showing the empty state — but we double-check here in case
    // `start()` was wired into another surface in the future.
    const existing = useSessionStore.getState().session;
    if (!existing) {
      errorRef.current =
        "No hay sesión activa. Volvé al inicio para empezar una.";
      return;
    }
    if (existing.status !== "active") {
      errorRef.current = "Esta sesión ya finalizó. Empezá una nueva.";
      return;
    }

    isStartingRef.current = true;
    errorRef.current = null;

    try {
      // Use the session from the store as-is. No POST.
      const sessionRow = existing;
      const effectiveScenarioId: string = sessionRow.scenario ?? "";
      analytics.track({
        name: "session_start",
        scenario: effectiveScenarioId,
      });

      // 1. Connect WS clients.
      const uplink = audioUplinkFactory(sessionRow.id, user.id);
      audioUplinkRef.current = uplink;
      await uplink.connect({
        onStatus: () => {},
        onLog: () => {},
      });

      const agent = agentStreamFactory(sessionRow.id);
      agentStreamRef.current = agent;

      // Fase E2 — helpers for the "unclear" phase auto-reset timer.
      // Centralised here so the handler can clear/arm it cleanly per
      // event and the cleanup effect can null it out on unmount.
      const clearUnclearTimeout = (): void => {
        if (unclearTimeoutRef.current !== null) {
          clearTimeout(unclearTimeoutRef.current);
          unclearTimeoutRef.current = null;
        }
      };
      const armUnclearTimeout = (): void => {
        clearUnclearTimeout();
        unclearTimeoutRef.current = setTimeout(() => {
          // Only flip to idle if no other event already moved us out
          // of "unclear" (a subsequent listening/thinking already did).
          if (useAgentStore.getState().phase === "unclear") {
            setPhase("idle");
          }
          unclearTimeoutRef.current = null;
        }, 5000);
      };

      const agentUnsub = agent.onMessage((event) => {
        handleAgentEvent(event, {
          sessionId: sessionRow.id,
          pushTranscript,
          pushHint,
          upsertSpeaker,
          setSpeakers,
          setPhase,
          appendChunk,
          setCurrent,
          commitCurrent,
          clearCurrent,
          armUnclearTimeout,
          clearUnclearTimeout,
        });
      });
      agentUnsubRef.current = agentUnsub;
      await agent.connect({
        onStatus: () => {},
        onLog: () => {},
      });

      // G2 — wire the screen-OCR sink so `useScreenOcr` forwards every
      // new valid extraction to the backend via this agent socket.
      // Using a store-held sink (instead of plumbing the agent stream
      // through SidebarLayout) keeps the hook tree shallow: any
      // subscriber of the OCR store can subscribe the same way as
      // before, and we only register the sink while there's an
      // actively-capturing agent stream to flush into.
      useScreenOcrStore.getState().setSink((entry) => {
        const live = agentStreamRef.current;
        if (!live) return;
        live.sendScreenText({
          text: entry.text,
          confidence: entry.confidence,
          capturedAtMs: entry.capturedAt,
        });
      });

      const transcriptsUnsub = transcriptsStream.onMessage((msg) => {
        handleTranscriptMessage(msg, {
          sessionId: sessionRow.id,
          pushTranscript,
          upsertSpeaker,
          scenarioId: effectiveScenarioId.length > 0 ? effectiveScenarioId : null,
        });
      });
      transcriptsUnsubRef.current = transcriptsUnsub;
      await transcriptsStream.connect({
        onStatus: () => {},
        onLog: () => {},
      });

      // 2. Start audio capture (last — getDisplayMedia user-gesture).
      // Always keepVideo=true: video tracks sit in the stream cheaply
      // until a <video srcObject> renders them, and this lets the user
      // switch to sidebar mid-session and still see the mirror without
      // having to Stop+Start. The MediaStream is pushed to the session
      // store via onStream so SidebarLayout (and any future subscriber)
      // can react to it reactively.
      // eslint-disable-next-line no-console
      console.info(`[susurra/diag] start() → about to call audioCapture.start()`);
      await audioCapture.start(
        {
          onStatus: (state) => {
            setIsCapturing(state === "running");
          },
          onPCM: (buffer) => {
            uplink.send(buffer);
          },
          onFrame: (frames, bytes) => {
            recordFrame(frames, bytes);
          },
          onLog: () => {},
          onStream: (stream) => {
            // eslint-disable-next-line no-console
            console.info(
              `[susurra/diag] onStream invoked tracks=${stream.getTracks().length} audio=${stream.getAudioTracks().length} video=${stream.getVideoTracks().length}`,
            );
            setCurrentStream(stream);
          },
        },
        {
          keepVideo: true,
        },
      );
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errorRef.current = message;
      // eslint-disable-next-line no-console
      console.error(`[susurra/diag] start() ERROR:`, err);
      // eslint-disable-next-line no-console
      console.error("[susurra/live] start failed", err);
      // Best-effort cleanup.
      try {
        audioUplinkRef.current?.close();
        agentStreamRef.current?.close();
        transcriptsUnsubRef.current?.();
        agentUnsubRef.current?.();
        transcriptsStream.close();
        await audioCapture.stop();
        setCurrentStream(null);
      } catch {
        // ignore
      }
    } finally {
      // eslint-disable-next-line no-console
      console.info(`[susurra/diag] start() FINALLY isStartingRef→false`);
      isStartingRef.current = false;
    }
  }, [
    user,
    audioCapture,
    audioUplinkFactory,
    agentStreamFactory,
    transcriptsStream,
    pushTranscript,
    pushHint,
    upsertSpeaker,
    setSpeakers,
    setPhase,
    appendChunk,
    setCurrent,
    commitCurrent,
    clearCurrent,
    setIsCapturing,
    setCurrentStream,
    recordFrame,
    analytics,
  ]);

  // ------------------------------------------------------------------
  // stop()
  // ------------------------------------------------------------------
  const stop = useCallback(async () => {
    if (isStoppingRef.current) return;
    isStoppingRef.current = true;
    try {
      await audioCapture.stop();
      // Clear the stream BEFORE any other teardown so React subscribers
      // unmount the <video> element promptly and don't try to render a
      // stream whose tracks have just been stopped.
      setCurrentStream(null);
      // G2 — drop the screen-OCR sink BEFORE tearing down the agent
      // stream so a late extraction can't slip through and try to send
      // on a half-closed socket.
      useScreenOcrStore.getState().setSink(null);
      audioUplinkRef.current?.close();
      audioUplinkRef.current = null;
      agentUnsubRef.current?.();
      agentUnsubRef.current = null;
      agentStreamRef.current?.close();
      agentStreamRef.current = null;
      transcriptsUnsubRef.current?.();
      transcriptsUnsubRef.current = null;
      transcriptsStream.close();

      const current = useSessionStore.getState().session;
      if (current && current.status === "active") {
        try {
          const ended = await endSession.execute(current.id);
          setSession(ended);
          analytics.track({
            name: "session_end",
            scenario: ended.scenario,
            durationSeconds: ended.durationSeconds ?? 0,
          });
        } catch (err: unknown) {
          // eslint-disable-next-line no-console
          console.warn("[susurra/live] end-session failed", err);
        }
      }
    } finally {
      isStoppingRef.current = false;
    }
  }, [
    audioCapture,
    transcriptsStream,
    endSession,
    setSession,
    setCurrentStream,
    analytics,
  ]);

  return {
    start,
    stop,
    isCapturing,
    isStarting: isStartingRef.current,
    isStopping: isStoppingRef.current,
    error: errorRef.current,
    framesSent,
    bytesSent,
    durationSeconds: session?.durationSeconds ?? durationSeconds,
    hydrationFinished,
  };
}

// ---------------------------------------------------------------------
// Pure event handlers — exported separately for testing if needed.
// ---------------------------------------------------------------------

interface TranscriptHandlerCtx {
  sessionId: string;
  scenarioId: string | null;
  pushTranscript: (t: Transcript) => void;
  upsertSpeaker: (s: Speaker) => void;
}

function handleTranscriptMessage(
  msg: TranscriptStreamMessage,
  ctx: TranscriptHandlerCtx,
): void {
  if (msg.type === "error") return;
  if (msg.type !== "transcript" && msg.type !== "token") return;

  const speakerNum = msg.speaker;
  const transcript: Transcript = {
    sessionId: ctx.sessionId,
    speakerId: null,
    deepgramSpeaker: speakerNum,
    content: msg.content,
    isFinal: msg.isFinal,
    timestampMs: msg.ms,
    language: null,
    confidence: null,
  };
  ctx.pushTranscript(transcript);

  // Optimistic speaker placeholder so the UI can render an avatar/chip
  // before the backend has registered the row. Backend's
  // speaker_label_updated event will reconcile real id later.
  if (speakerNum != null) {
    ctx.upsertSpeaker({
      id: -1 - speakerNum, // negative sentinel until real id arrives
      sessionId: ctx.sessionId,
      deepgramSpeakerId: speakerNum,
      label: null,
      isUser: false,
      colorHint: ctx.scenarioId ? scenarioColorOf(ctx.scenarioId) : "lime",
    });
  }
}

interface AgentHandlerCtx {
  sessionId: string;
  pushTranscript: (t: Transcript) => void;
  pushHint: (h: Hint) => void;
  upsertSpeaker: (s: Speaker) => void;
  setSpeakers: (list: Speaker[]) => void;
  setPhase: (p: AgentPhase) => void;
  appendChunk: (chunk: string) => void;
  setCurrent: (text: string) => void;
  commitCurrent: (ms?: number) => void;
  clearCurrent: () => void;
  /**
   * Fase E2 — arm the 5s timer that auto-resets the phase from
   * "unclear" back to "idle" when no follow-up event arrives.
   */
  armUnclearTimeout: () => void;
  /**
   * Fase E2 — clear any pending "unclear" auto-reset timer. Called on
   * every other phase transition so the timer doesn't fire stale and
   * clobber a fresh listening/thinking/responding phase.
   */
  clearUnclearTimeout: () => void;
}

function handleAgentEvent(event: AgentEvent, ctx: AgentHandlerCtx): void {
  switch (event.type) {
    case "connected":
      return;
    case "transcript":
      // Backend re-broadcast; use the overlay path for live updates.
      // Skip to avoid double-posting; backend transcripts arrive after
      // persistence which is handled via session detail re-fetch.
      return;
    case "listening":
      ctx.clearUnclearTimeout();
      ctx.setPhase("listening");
      return;
    case "unclear":
      // Fase E2 — backend gated a low-confidence final. Show the
      // "No te escuché bien — repetí por favor" badge and start a 5s
      // self-clear timer so the badge doesn't get stuck if the user
      // stays silent.
      ctx.setPhase("unclear");
      ctx.armUnclearTimeout();
      return;
    case "thinking":
      ctx.clearUnclearTimeout();
      ctx.setPhase("thinking");
      ctx.setCurrent(event.text);
      return;
    case "responding":
      // Backend says the first LLM token is about to arrive. The actual
      // chunk events (case "response") will also flip phase to
      // "responding" via appendChunk, but emitting this explicitly lets
      // the UI lead the eye by ~50ms.
      ctx.clearUnclearTimeout();
      ctx.setPhase("responding");
      return;
    case "response":
      ctx.appendChunk(event.text);
      return;
    case "response_speculative":
      ctx.setCurrent(event.text);
      return;
    case "cancelled":
      ctx.clearCurrent();
      return;
    case "speaker_label_updated":
      ctx.upsertSpeaker(event.speaker);
      return;
    case "speakers_merged":
      ctx.setSpeakers([...event.speakers]);
      return;
    case "pong":
    case "error":
      return;
  }
}
