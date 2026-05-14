"use client";

/**
 * RecordingDetail — composite playback view.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────┐
 *   │ Header — back / title / actions (Regenerar | Compartir | Eliminar) │
 *   ├─────────────────────────────────────────────────────────┤
 *   │ AudioPlayer — full width                                │
 *   ├──────────────────────────────┬──────────────────────────┤
 *   │ PlaybackTranscript           │ PlaybackHints + Summary  │
 *   └──────────────────────────────┴──────────────────────────┘
 *
 * State:
 *  - `useRecordingPlayback(sessionId)` — playback aggregate.
 *  - `useShareLinks(sessionId)` — share modal state.
 *  - `useTierGate("share_links")` — gates the modal CTA on Free tier.
 *  - `useAudioSync(transcripts)` — owned here so PlaybackTranscript can
 *    call `seekToTimestampMs` on click.
 *  - `usePreferences()` — used to render the auto-delete info text.
 *
 * Regenerate flow:
 *   POST /regenerate-summary returns immediately; we display a "Regenerando…"
 *   pill and re-poll the detail every 4s for up to 60s. Summary appears in
 *   place once available.
 *
 * Delete flow:
 *   Confirms via window.confirm, then DELETEs the recording and calls
 *   onAfterDelete to navigate the parent back to the list.
 */

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type JSX,
} from "react";
import { Button, Card, Pill, Spinner } from "@/design-system/primitives";
import { useContainer } from "@/infrastructure/di/container";
import { useRecordingPlayback } from "@/presentation/hooks/use-recording-playback";
import { useShareLinks } from "@/presentation/hooks/use-share-links";
import { useTierGate } from "@/presentation/hooks/use-tier-gate";
import { usePreferences } from "@/presentation/hooks/use-preferences";
import { useAudioSync } from "@/presentation/hooks/use-audio-sync";
import { useAnalytics } from "@/presentation/hooks/use-analytics";
import { AudioPlayer } from "./AudioPlayer";
import { PlaybackTranscript } from "./PlaybackTranscript";
import { PlaybackHints } from "./PlaybackHints";
import { ShareLinkModal } from "./ShareLinkModal";
import {
  formatBytes,
  formatDateTime,
  formatDuration,
  scenarioColorOfId,
  scenarioColorVar,
  scenarioLabel,
  sessionTitleOrFallback,
} from "./utils";
import type { Transcript } from "@/domain/entities/transcript";
import type { Hint } from "@/domain/entities/hint";

interface RecordingDetailProps {
  sessionId: string;
  onBack: () => void;
  onAfterDelete: () => void;
}

const REGEN_POLL_INTERVAL_MS = 4000;
const REGEN_POLL_TIMEOUT_MS = 60_000;

export function RecordingDetail({
  sessionId,
  onBack,
  onAfterDelete,
}: RecordingDetailProps): JSX.Element {
  const { regenerateSessionSummary, deleteRecording } = useContainer();
  const { playback, loading, error, refresh } = useRecordingPlayback(sessionId);
  const shareGate = useTierGate("share_links");
  const shareLinks = useShareLinks(sessionId);
  const { prefs } = usePreferences();
  const { track } = useAnalytics();
  const playTrackedRef = useRef(false);

  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [regenError, setRegenError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const regenStartedAtRef = useRef<number | null>(null);

  // Lift the audio sync hook here so PlaybackTranscript can drive it.
  const transcripts = useMemo<Transcript[]>(
    () => playback?.transcripts ?? [],
    [playback?.transcripts],
  );
  const sync = useAudioSync(transcripts);

  // Reset the per-recording one-shot guard when the user navigates between
  // recordings (so each new sessionId fires its own `recording_played`).
  useEffect(() => {
    playTrackedRef.current = false;
  }, [sessionId]);

  // Fire `recording_played` exactly once per session view, on the first
  // play transition (isPlaying flips false → true).
  useEffect(() => {
    if (!sync.isPlaying) return;
    if (playTrackedRef.current) return;
    playTrackedRef.current = true;
    track({ name: "recording_played" });
  }, [sync.isPlaying, track]);

  // Poll for the regenerated summary.
  useEffect(() => {
    if (!regenerating) return;
    const start = regenStartedAtRef.current ?? Date.now();
    const initialSummary = playback?.session.summary ?? null;
    const id = window.setInterval(() => {
      const elapsed = Date.now() - start;
      if (elapsed > REGEN_POLL_TIMEOUT_MS) {
        setRegenerating(false);
        setRegenError(
          "La regeneración está tardando más de lo normal. Probá refrescar en un momento.",
        );
        window.clearInterval(id);
        return;
      }
      void refresh().then(() => {
        // The post-refresh `playback` is captured via closure on the next
        // render — inspect via a fresh read on the regenStartedAt guard.
        // We trust refresh() to re-render and the effect to re-run; no
        // additional read here.
      });
      // Stop polling when summary changes.
      const currentSummary = playback?.session.summary ?? null;
      if (
        currentSummary !== null &&
        currentSummary !== initialSummary &&
        currentSummary !== ""
      ) {
        setRegenerating(false);
        window.clearInterval(id);
      }
    }, REGEN_POLL_INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [regenerating, refresh, playback?.session.summary]);

  const handleRegenerate = useCallback(async (): Promise<void> => {
    setRegenError(null);
    setRegenerating(true);
    regenStartedAtRef.current = Date.now();
    try {
      await regenerateSessionSummary.execute(sessionId);
      // Kick a refresh now (we'll re-poll in the effect above).
      await refresh();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos regenerar el resumen.";
      setRegenError(msg);
      setRegenerating(false);
    }
  }, [regenerateSessionSummary, refresh, sessionId]);

  const handleDelete = useCallback(async (): Promise<void> => {
    if (typeof window === "undefined") return;
    const ok = window.confirm(
      "¿Eliminar grabación? El audio se borra del servidor; el transcript queda guardado.",
    );
    if (!ok) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteRecording.execute(sessionId);
      sync.release();
      onAfterDelete();
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos eliminar la grabación.";
      setDeleteError(msg);
    } finally {
      setDeleting(false);
    }
  }, [deleteRecording, sessionId, sync, onAfterDelete]);

  const handleSeekTranscript = useCallback(
    (t: Transcript) => {
      sync.seekToTimestampMs(t.timestampMs, true);
    },
    [sync],
  );
  const handleSeekHint = useCallback(
    (h: Hint) => {
      sync.seekToTimestampMs(h.timestampMs, true);
    },
    [sync],
  );

  if (loading && !playback) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: 24,
          color: "var(--color-text-mid)",
          fontSize: 14,
        }}
      >
        <Spinner size={18} />
        <span>Cargando grabación…</span>
      </div>
    );
  }

  if (error || !playback) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Volver a la lista
        </Button>
        <Card
          style={{
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            {error ?? "No encontramos la grabación."}
          </p>
        </Card>
      </div>
    );
  }

  const { session, recording, audioUrl, hints, speakers } = playback;
  const color = scenarioColorOfId(session.scenario);
  const colorVar = scenarioColorVar(color);
  const title = sessionTitleOrFallback(
    session.title,
    session.scenario,
    session.startedAt,
  );

  const autoDeleteDays = prefs?.autoDeleteRecordingsDays ?? null;
  const autoDeleteText =
    autoDeleteDays === null
      ? "Esta grabación se conserva hasta que la elimines."
      : `Se elimina automáticamente ${autoDeleteDays} días después de creada.`;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <Button variant="ghost" size="sm" onClick={onBack}>
          ← Volver a la lista
        </Button>
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }}>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <Pill variant="ghost">
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: colorVar,
                    display: "inline-block",
                  }}
                />
                {scenarioLabel(session.scenario)}
              </Pill>
              <span
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                  fontSize: 11,
                  color: "var(--color-text-dim)",
                }}
              >
                {formatDateTime(session.startedAt)}
              </span>
              <span
                style={{
                  fontFamily:
                    "var(--font-jetbrains-mono), ui-monospace, monospace",
                  fontSize: 11,
                  color: "var(--color-text-dim)",
                }}
              >
                {formatDuration(recording.audioDurationSeconds)} ·{" "}
                {formatBytes(recording.audioSizeBytes)} ·{" "}
                {recording.audioFormat.toUpperCase()}
              </span>
            </div>
            <h1
              style={{
                margin: 0,
                fontSize: 30,
                fontWeight: 700,
                letterSpacing: "-1px",
                color: "var(--color-text)",
              }}
            >
              {title}
            </h1>
            <p
              style={{
                margin: 0,
                fontSize: 12,
                color: "var(--color-text-dim)",
              }}
            >
              {autoDeleteText} (configurable en{" "}
              <a
                href="/app/settings"
                style={{ color: "var(--color-text-mid)" }}
              >
                preferencias
              </a>
              ).
            </p>
          </div>

          <div
            style={{
              display: "flex",
              gap: 8,
              flexWrap: "wrap",
            }}
          >
            <Button
              variant="ghost"
              size="md"
              disabled={regenerating}
              onClick={() => void handleRegenerate()}
            >
              {regenerating ? "Regenerando…" : "Regenerar resumen"}
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => setShareModalOpen(true)}
            >
              Compartir
            </Button>
            <Button
              variant="ghost"
              size="md"
              disabled={deleting}
              onClick={() => void handleDelete()}
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </Button>
          </div>
        </div>

        {regenError ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-amber-ink)",
              background: "var(--color-amber)",
              padding: "8px 12px",
              borderRadius: 12,
            }}
          >
            {regenError}
          </p>
        ) : null}
        {deleteError ? (
          <p
            role="alert"
            style={{
              margin: 0,
              fontSize: 13,
              color: "var(--color-amber-ink)",
              background: "var(--color-amber)",
              padding: "8px 12px",
              borderRadius: 12,
            }}
          >
            {deleteError}
          </p>
        ) : null}
      </div>

      {/* Player */}
      <AudioPlayer audioUrl={audioUrl} sync={sync} />

      {/* Summary card */}
      {session.summary || session.actionItems.length > 0 ? (
        <Card variant="soft" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <Pill variant="lavender">Resumen</Pill>
            {regenerating ? (
              <span
                style={{
                  fontSize: 11,
                  color: "var(--color-text-mid)",
                }}
              >
                Regenerando con IA…
              </span>
            ) : null}
          </div>
          {session.summary ? (
            <p
              style={{
                margin: 0,
                fontSize: 14,
                lineHeight: 1.55,
                color: "var(--color-text)",
              }}
            >
              {session.summary}
            </p>
          ) : (
            <p
              style={{
                margin: 0,
                fontSize: 13,
                color: "var(--color-text-mid)",
              }}
            >
              Todavía no hay resumen guardado.
            </p>
          )}
          {session.actionItems.length > 0 ? (
            <ul
              style={{
                margin: 0,
                paddingLeft: 18,
                fontSize: 13,
                color: "var(--color-text)",
                lineHeight: 1.5,
              }}
            >
              {session.actionItems.map((item, idx) => (
                <li key={`${idx}-${item.slice(0, 6)}`}>{item}</li>
              ))}
            </ul>
          ) : null}
        </Card>
      ) : null}

      {/* Two-column transcript + hints */}
      <div
        style={{
          display: "grid",
          gap: 16,
          gridTemplateColumns: "minmax(0, 2fr) minmax(0, 1fr)",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--color-text-mid)",
              letterSpacing: "0.4px",
              textTransform: "uppercase" as const,
            }}
          >
            Transcript
          </h2>
          <PlaybackTranscript
            transcripts={transcripts}
            speakers={speakers}
            activeTranscriptId={sync.activeTranscriptId}
            onSeek={handleSeekTranscript}
          />
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <h2
            style={{
              margin: 0,
              fontSize: 14,
              fontWeight: 700,
              color: "var(--color-text-mid)",
              letterSpacing: "0.4px",
              textTransform: "uppercase" as const,
            }}
          >
            Sugerencias
          </h2>
          <PlaybackHints
            hints={hints}
            currentTimeSec={sync.currentTime}
            onSeek={handleSeekHint}
          />
        </div>
      </div>

      <ShareLinkModal
        open={shareModalOpen}
        links={shareLinks.links}
        loading={shareLinks.loading}
        error={shareLinks.error}
        creating={shareLinks.creating}
        createError={shareLinks.createError}
        revoking={shareLinks.revoking}
        gateAvailable={shareGate.available}
        gateRequiredTier={shareGate.requiredTier ?? null}
        onCreate={shareLinks.create}
        onRevoke={shareLinks.revoke}
        onClose={() => setShareModalOpen(false)}
      />
    </div>
  );
}
