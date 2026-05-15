"use client";

/**
 * Live (/app/live) — F2 + F5 implementation.
 *
 * Wires the orchestrator hook (useLiveSession) into the LiveControls +
 * the layout the user picked from the Tweaks panel. F5 swaps the F2
 * placeholders for real PipLayout (Document PiP overlay) and SidebarLayout
 * (transcript+hints sidebar).
 *
 * Wave 1B: when the user just stopped a session (`session.status === "ended"`
 * AND not currently capturing) we render `EndedState` instead of the live
 * layout — gives the user a clear "session finalised" surface with the
 * summary and a CTA to start a new session or open the history.
 *
 * Single-path session-creation (architecture/single-path-session-creation):
 *   The Modal Nueva Sesión is the ONLY way to create a session. The live
 *   page is purely a "connect to an existing session" surface. It learns
 *   about the session through one of two channels:
 *     1. `?sessionId=...` query param (modal happy path).
 *     2. Backend recovery (`/sessions/active`) — for refresh during
 *        capture.
 *   If neither channel yields a session AND we're not capturing, we
 *   render a friendly empty state with a CTA to `/app`. We never POST
 *   from this page.
 */

import { useEffect, useRef, type JSX } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTweaksStore } from "@/application/stores/tweaks.store";
import { useSessionStore } from "@/application/stores/session.store";
import { useLiveSession } from "@/presentation/hooks/use-live-session";
import { useGlobalHotkeys } from "@/presentation/hooks/use-global-hotkeys";
import { LiveControls } from "@/presentation/components/live/LiveControls";
import { StandaloneLayout } from "@/presentation/components/live/StandaloneLayout";
import { PipLayout } from "@/presentation/components/live/PipLayout";
import { SidebarLayout } from "@/presentation/components/live/SidebarLayout";
import { TweaksPanel } from "@/presentation/components/live/TweaksPanel";
import { EndedState } from "@/presentation/components/live/EndedState";
import { MeetingInfoCard } from "@/presentation/components/live/MeetingInfoCard";
import { Button, Card } from "@/design-system/primitives";
import { ArrowRightIcon, MicIcon } from "@/design-system/icons";

export default function LivePage(): JSX.Element {
  // eslint-disable-next-line no-console
  console.info(`[susurra/diag] LivePage render`);
  // Global keyboard shortcuts — Cmd+Shift+H (peek-dim) and Cmd+Shift+P
  // (force-regenerate). Mounted at the top so they're active for the
  // entire lifetime of the live page, regardless of the active layout.
  useGlobalHotkeys();

  const layout = useTweaksStore((s) => s.layout);
  // `isHidden` is the global peek-dim flag toggled by Cmd+Shift+H. We
  // apply it at the page level for the SidebarLayout (PipLayout owns its
  // own dim treatment so the control card + fallback share the same
  // surface). Standalone is intentionally NOT dimmed — it's the default
  // full-page surface and dimming it would feel like a bug.
  const isHidden = useTweaksStore((s) => s.isHidden);
  const router = useRouter();
  const searchParams = useSearchParams();
  // Snapshot the URL `sessionId` at render time. `useSearchParams` returns
  // a fresh `ReadonlyURLSearchParams` per render so the value is stable for
  // each click on "Iniciar captura". `null` when the user landed on
  // /app/live without going through the modal.
  const sessionIdFromUrl = searchParams?.get("sessionId") ?? null;

  // Pass the URL session id to the hook so it hydrates the store from
  // that exact session on mount. `hydrationFinished` tells us when the
  // first hydration attempt (URL or recovery) has settled — used below
  // to decide between "live layout" and "friendly empty state" without
  // a flash.
  const { start, stop, hydrationFinished } = useLiveSession({
    sessionIdFromUrl,
  });
  const session = useSessionStore((s) => s.session);
  const isCapturing = useSessionStore((s) => s.isCapturing);

  // Once capture starts, clear the `?sessionId=` query param so:
  //   - a tab refresh during capture doesn't re-trigger a stale
  //     `getSessionDetail` for an id whose recovery is now handled by
  //     the FR-22 effect inside useLiveSession.
  //   - the URL doesn't keep dangling state that's only meaningful for
  //     the one-shot transition from modal → capture.
  // We use a ref guard so HMR / strict-mode double-mounts don't loop.
  const urlClearedRef = useRef(false);
  useEffect(() => {
    if (!isCapturing) return;
    if (!sessionIdFromUrl) return;
    if (urlClearedRef.current) return;
    urlClearedRef.current = true;
    router.replace("/app/live");
  }, [isCapturing, sessionIdFromUrl, router]);

  // ENDED state shows when we have a session row that has finalised AND
  // capture has stopped. The recovery flow on mount may rehydrate an
  // ended session, in which case we still want to show the summary card
  // so the user lands on a clear surface (not a blank standalone layout).
  const showEnded =
    session !== null && session.status !== "active" && !isCapturing;

  // EMPTY state: the user landed on /app/live without a sessionId in
  // the URL AND recovery didn't find an active session in the backend.
  // In single-path-creation we no longer let the page POST a session
  // implicitly — instead we tell the user to start one from /app.
  // Gated on `hydrationFinished` so it doesn't flash while the recovery
  // request is in flight.
  const showEmpty = hydrationFinished && session === null && !isCapturing;

  let LayoutComponent: () => JSX.Element;
  if (layout === "pip") {
    LayoutComponent = PipLayout;
  } else if (layout === "sidebar") {
    LayoutComponent = SidebarLayout;
  } else {
    LayoutComponent = StandaloneLayout;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "row",
        gap: 16,
        height: "100%",
        minHeight: 0,
      }}
    >
      <div
        style={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <LiveControls
          onStart={() => void start()}
          onStop={() => void stop()}
        />
        {session && session.meetingUrl ? (
          <MeetingInfoCard
            meetingUrl={session.meetingUrl}
            meetingCode={session.meetingCode}
          />
        ) : null}
        {showEnded && session ? (
          <EndedState session={session} />
        ) : showEmpty ? (
          <NoActiveSessionState onGoHome={() => router.push("/app")} />
        ) : layout === "sidebar" && isHidden ? (
          // Peek-dim wrapper for SidebarLayout — PiP handles its own
          // hide path inside PipLayout (so the slider value composes
          // cleanly with the hide flag there).
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              opacity: 0.1,
              pointerEvents: "none",
              transition: "opacity 160ms ease",
            }}
          >
            <LayoutComponent />
          </div>
        ) : (
          <LayoutComponent />
        )}
      </div>
      <TweaksPanel />
    </div>
  );
}

// ---------------------------------------------------------------------
// NoActiveSessionState — friendly empty state shown when /app/live was
// reached without a session id and recovery returned nothing. Matches
// the visual language of EndedState (Card + soft styling + ArrowRight
// CTA) so the screen feels coherent across "before / after" surfaces.
// ---------------------------------------------------------------------
function NoActiveSessionState({
  onGoHome,
}: {
  onGoHome: () => void;
}): JSX.Element {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "24px 0",
      }}
    >
      <Card
        variant="soft"
        style={{
          maxWidth: 520,
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: 18,
          padding: 28,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
          }}
        >
          <span
            aria-hidden
            style={{
              width: 44,
              height: 44,
              borderRadius: 14,
              background: "var(--color-bg)",
              border: "1px solid var(--color-border)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--color-text)",
              flexShrink: 0,
            }}
          >
            <MicIcon size={20} />
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <h2
              style={{
                margin: 0,
                fontSize: 18,
                fontWeight: 700,
                letterSpacing: "-0.3px",
                color: "var(--color-text)",
              }}
            >
              No tenés ninguna sesión activa
            </h2>
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--color-text-mid)",
                lineHeight: 1.5,
              }}
            >
              Empezá una desde el inicio para configurar el escenario,
              los documentos y el idioma.
            </p>
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Button
            variant="primary"
            size="md"
            trailingIcon={<ArrowRightIcon size={16} />}
            onClick={onGoHome}
          >
            Ir al inicio
          </Button>
        </div>
      </Card>
    </div>
  );
}
