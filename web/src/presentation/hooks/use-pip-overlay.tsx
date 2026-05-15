"use client";

/**
 * usePipOverlay — manages the lifecycle of the document Picture-in-Picture
 * overlay window from the host page.
 *
 * Architecture:
 *   - PiP window opens via the application use-case (TogglePipOverlayUseCase)
 *     which delegates to the DocumentPipAdapter (PipOverlayPort). The hook
 *     never imports infrastructure directly.
 *   - The React tree inside the PiP window is mounted with React 19's
 *     `createRoot(pipDocument.body)` against the `#susurra-pip-root` div the
 *     adapter plants there.
 *   - State propagation: every render of the host hook builds a fresh
 *     `OverlaySnapshot` from Zustand stores and re-renders the PiP root
 *     with it. Because the React subtree is created from the host context,
 *     its closures already reach `start`/`stop` actions — no need for
 *     BroadcastChannel / postMessage to dispatch actions.
 *   - User gesture: `open()` MUST be called from a click handler — Chromium
 *     blocks `requestWindow()` outside a user gesture. Presentation wires
 *     the hook to a `<Button onClick={open}>`.
 *   - Graceful degradation: `isSupported === false` on Firefox/Safari →
 *     Layout shows a disabled button + explanation. We DO NOT alert from
 *     here; the layout owns that copy.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { useContainer } from "@/infrastructure/di/container";
import { useSessionStore } from "@/application/stores/session.store";
import {
  useAgentStore,
  selectIsThinking,
} from "@/application/stores/agent.store";
import { useScenarioStore } from "@/application/stores/scenario.store";
import type { OverlaySnapshot } from "@/infrastructure/pip/constants";
import { PipOverlayContent } from "@/presentation/components/overlay/PipOverlayContent";
import { useLiveSession } from "./use-live-session";
import { scenarioColorOf } from "@/domain/entities/scenario";

interface UsePipOverlayResult {
  isOpen: boolean;
  isSupported: boolean;
  open: () => Promise<void>;
  close: () => void;
}

export function usePipOverlay(): UsePipOverlayResult {
  const { togglePipOverlay, analytics } = useContainer();
  const { start, stop } = useLiveSession();

  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<Root | null>(null);

  const isSupported = useMemo(
    () => togglePipOverlay.isSupported(),
    [togglePipOverlay],
  );

  // ----- Live snapshot inputs (Zustand subscribers) ----------------------
  const session = useSessionStore((s) => s.session);
  const transcripts = useSessionStore((s) => s.transcripts);
  const interim = useSessionStore((s) => s.interim);
  const speakers = useSessionStore((s) => s.speakers);
  const durationSeconds = useSessionStore((s) => s.durationSeconds);

  const currentResponse = useAgentStore((s) => s.currentResponse);
  const responses = useAgentStore((s) => s.responses);
  const isThinking = useAgentStore(selectIsThinking);

  const scenario = useScenarioStore((s) => s.current);
  const availableScenarios = useScenarioStore((s) => s.available);

  // Memoise snapshot so we re-render PiP only when something actually changed.
  const snapshot = useMemo<OverlaySnapshot>(() => {
    const lastTranscript =
      interim ?? transcripts[transcripts.length - 1] ?? null;
    const speakerLabel =
      lastTranscript?.deepgramSpeaker != null
        ? (speakers.get(lastTranscript.deepgramSpeaker)?.label ?? null)
        : null;
    const scenarioLabel =
      availableScenarios.find((sc) => sc.id === scenario)?.label ?? null;
    const lastResponseText = responses[responses.length - 1]?.text ?? "";

    return {
      isLive: !!session && session.status === "active",
      scenarioColor: scenario ? scenarioColorOf(scenario) : "lime",
      scenarioLabel,
      transcript: lastTranscript
        ? {
            content: lastTranscript.content,
            speakerLabel,
            isFinal: lastTranscript.isFinal,
          }
        : null,
      currentResponse,
      lastResponse: lastResponseText,
      isThinking,
      durationSeconds,
    };
  }, [
    session,
    transcripts,
    interim,
    speakers,
    durationSeconds,
    currentResponse,
    responses,
    isThinking,
    scenario,
    availableScenarios,
  ]);

  // ----- Open / close ----------------------------------------------------
  const open = useCallback(async (): Promise<void> => {
    if (!togglePipOverlay.isSupported()) return;
    if (togglePipOverlay.isOpen()) return;

    try {
      const handle = await togglePipOverlay.open(() => {
        // Native close handler — fired exactly once per overlay.
        rootRef.current?.unmount();
        rootRef.current = null;
        setIsOpen(false);
      });
      const doc = handle.getDocument();
      if (!doc) {
        // Already closed before we could mount — nothing to do.
        setIsOpen(false);
        return;
      }
      const rootEl = doc.getElementById("susurra-pip-root");
      if (!rootEl) {
        // Shouldn't happen — adapter plants this. Defensive.
        // eslint-disable-next-line no-console
        console.warn("[susurra/pip] root element missing in PiP window");
        handle.close();
        return;
      }
      const root = createRoot(rootEl);
      rootRef.current = root;
      setIsOpen(true);
      analytics.track({ name: "pip_opened" });
    } catch (err: unknown) {
      // eslint-disable-next-line no-console
      console.error("[susurra/pip] open failed", err);
    }
  }, [togglePipOverlay, analytics]);

  const close = useCallback((): void => {
    togglePipOverlay.close();
  }, [togglePipOverlay]);

  // ----- Keep the PiP tree in sync with snapshot -------------------------
  useEffect(() => {
    if (!isOpen) return;
    const root = rootRef.current;
    if (!root) return;
    root.render(
      <PipOverlayContent
        snapshot={snapshot}
        onStart={() => {
          void start();
        }}
        onStop={() => {
          void stop();
        }}
      />,
    );
  }, [isOpen, snapshot, start, stop]);

  // ----- On unmount: ensure the PiP window doesn't leak ------------------
  useEffect(() => {
    return () => {
      togglePipOverlay.close();
      rootRef.current?.unmount();
      rootRef.current = null;
    };
  }, [togglePipOverlay]);

  return { isOpen, isSupported, open, close };
}
