"use client";

/**
 * Session detail (/app/sessions/[id]) — F10 (Paso 3) implementation.
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────┐
 *   │ Hero — back / scenario badge / title / date · duration /     │
 *   │         actions menu (3-dots: Compartir / Exportar / Eliminar)│
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ Tabs — Resumen | Transcripts | Sugerencias | Hablantes        │
 *   ├─────────────────────────────────────────────────────────────┤
 *   │ Tab panel (whichever is active)                               │
 *   └─────────────────────────────────────────────────────────────┘
 *
 * Tab content owners (presentation components):
 *  - SessionResumenTab     — session.summary + action items + regenerate CTA
 *  - SessionTranscriptsTab — chronological transcripts grouped by speaker
 *  - SessionHintsTab       — agent suggestions sorted by timestampMs
 *  - SessionSpeakersTab    — rename UI, calls POST /speakers/{id}/rename
 *
 * Actions menu:
 *  - Compartir → opens ShareLinkModal (reused from recordings). Pro+ gated.
 *  - Exportar → dropdown txt / md / pdf. PDF gated by `pdf_export`.
 *  - Eliminar sesión → DeleteSessionModal → DELETE /api/sessions/{id} → /app/sessions.
 *
 * Export implementation:
 *  - txt + md are generated entirely client-side from the loaded detail so
 *    they don't require a new backend endpoint. They use Blob + URL.createObjectURL.
 *  - pdf is left to a future iteration (backend endpoint not yet specified);
 *    the menu still gates the action and shows an info toast.
 */

import { use, useCallback, useMemo, useState, type JSX } from "react";
import { useRouter } from "next/navigation";
import { Card, Spinner } from "@/design-system/primitives";
import { useSessionDetail } from "@/presentation/hooks/use-session-detail";
import { useScenarios } from "@/presentation/hooks/use-scenarios";
import { useShareLinks } from "@/presentation/hooks/use-share-links";
import { useTierGate } from "@/presentation/hooks/use-tier-gate";
import { useBilling } from "@/presentation/hooks/use-billing";
import { ShareLinkModal } from "@/presentation/components/recordings/ShareLinkModal";
import { SessionDetailHero } from "@/presentation/components/sessions/SessionDetailHero";
import { SessionTabs } from "@/presentation/components/sessions/SessionTabs";
import { SessionResumenTab } from "@/presentation/components/sessions/SessionResumenTab";
import { SessionTranscriptsTab } from "@/presentation/components/sessions/SessionTranscriptsTab";
import { SessionHintsTab } from "@/presentation/components/sessions/SessionHintsTab";
import { SessionSpeakersTab } from "@/presentation/components/sessions/SessionSpeakersTab";
import { SessionActionsMenu } from "@/presentation/components/sessions/SessionActionsMenu";
import { DeleteSessionModal } from "@/presentation/components/sessions/DeleteSessionModal";
import {
  formatRelativeMs,
  scenarioLabel,
  sessionTitleOrFallback,
} from "@/presentation/components/sessions/utils";
import type { SessionTabKey } from "@/presentation/components/sessions/SessionTabs";
import type { SessionDetail } from "@/application/ports/sessions-api.port";
import type { Scenario } from "@/domain/entities/scenario";

type ExportFormat = "txt" | "md" | "pdf";

interface PageProps {
  params: Promise<{ id: string }>;
}

function buildExportText(
  detail: SessionDetail,
  scenarios: Scenario[],
  format: "txt" | "md",
): string {
  const { session, transcripts, hints, speakers } = detail;
  const title = sessionTitleOrFallback(
    session.title,
    session.scenario,
    session.startedAt,
    scenarios,
  );
  const speakerById = new Map(
    speakers.map((s) => [
      s.deepgramSpeakerId,
      s.label && s.label.trim().length > 0
        ? s.label
        : `Hablante ${s.deepgramSpeakerId + 1}`,
    ]),
  );

  const lines: string[] = [];
  if (format === "md") {
    lines.push(`# ${title}`);
    lines.push("");
    lines.push(`- **Escenario:** ${scenarioLabel(session.scenario, scenarios)}`);
    lines.push(`- **Inicio:** ${session.startedAt}`);
    if (session.endedAt) lines.push(`- **Fin:** ${session.endedAt}`);
    if (session.durationSeconds !== null)
      lines.push(`- **Duración (s):** ${session.durationSeconds}`);
    lines.push("");
    if (session.summary) {
      lines.push("## Resumen");
      lines.push("");
      lines.push(session.summary);
      lines.push("");
    }
    if (session.actionItems.length > 0) {
      lines.push("## Action items");
      lines.push("");
      for (const item of session.actionItems) lines.push(`- ${item}`);
      lines.push("");
    }
    lines.push("## Transcript");
    lines.push("");
    const sortedTranscripts = [...transcripts]
      .filter((t) => t.isFinal)
      .sort((a, b) => a.timestampMs - b.timestampMs);
    for (const t of sortedTranscripts) {
      const sp =
        t.deepgramSpeaker !== null
          ? speakerById.get(t.deepgramSpeaker) ?? "Hablante"
          : "Hablante";
      lines.push(`**${sp}** (${formatRelativeMs(t.timestampMs)}): ${t.content}`);
    }
    if (hints.length > 0) {
      lines.push("");
      lines.push("## Sugerencias");
      lines.push("");
      const sortedHints = [...hints].sort(
        (a, b) => a.timestampMs - b.timestampMs,
      );
      for (const h of sortedHints) {
        lines.push(`- (${formatRelativeMs(h.timestampMs)}) ${h.content}`);
      }
    }
  } else {
    lines.push(title);
    lines.push("=".repeat(Math.min(title.length, 64)));
    lines.push("");
    lines.push(`Escenario: ${scenarioLabel(session.scenario, scenarios)}`);
    lines.push(`Inicio: ${session.startedAt}`);
    if (session.endedAt) lines.push(`Fin: ${session.endedAt}`);
    if (session.durationSeconds !== null)
      lines.push(`Duración: ${session.durationSeconds}s`);
    lines.push("");
    if (session.summary) {
      lines.push("RESUMEN");
      lines.push("-------");
      lines.push(session.summary);
      lines.push("");
    }
    if (session.actionItems.length > 0) {
      lines.push("ACTION ITEMS");
      lines.push("------------");
      for (const item of session.actionItems) lines.push(`- ${item}`);
      lines.push("");
    }
    lines.push("TRANSCRIPT");
    lines.push("----------");
    const sortedTranscripts = [...transcripts]
      .filter((t) => t.isFinal)
      .sort((a, b) => a.timestampMs - b.timestampMs);
    for (const t of sortedTranscripts) {
      const sp =
        t.deepgramSpeaker !== null
          ? speakerById.get(t.deepgramSpeaker) ?? "Hablante"
          : "Hablante";
      lines.push(`[${formatRelativeMs(t.timestampMs)}] ${sp}: ${t.content}`);
    }
    if (hints.length > 0) {
      lines.push("");
      lines.push("SUGERENCIAS");
      lines.push("-----------");
      const sortedHints = [...hints].sort(
        (a, b) => a.timestampMs - b.timestampMs,
      );
      for (const h of sortedHints) {
        lines.push(`[${formatRelativeMs(h.timestampMs)}] ${h.content}`);
      }
    }
  }
  return lines.join("\n");
}

function triggerDownload(filename: string, content: string, mime: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function SessionDetailPage({ params }: PageProps): JSX.Element {
  const { id } = use(params);
  const router = useRouter();

  // Boot the billing store so tier gates inside the actions menu work.
  useBilling();

  const { available: scenarios } = useScenarios();
  const {
    detail,
    loading,
    error,
    refresh,
    regenerating,
    regenerateError,
    regenerateSummary,
    deleting,
    deleteError,
    deleteSession,
  } = useSessionDetail(id);

  // Reuse share infrastructure from F8 — same modal, same hook.
  const shareGate = useTierGate("share_links");
  const shareLinks = useShareLinks(id);

  const [activeTab, setActiveTab] = useState<SessionTabKey>("resumen");
  const [shareOpen, setShareOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const goBack = useCallback(() => {
    router.push("/app/sessions");
  }, [router]);

  const handleShareOpen = useCallback(() => {
    setShareOpen(true);
  }, []);

  const handleExport = useCallback(
    (fmt: ExportFormat) => {
      if (!detail) return;
      setExportNotice(null);
      const baseName = (detail.session.title?.trim().length
        ? detail.session.title.trim()
        : `sesion-${detail.session.id.slice(0, 8)}`
      )
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-");
      if (fmt === "txt") {
        const content = buildExportText(detail, scenarios, "txt");
        triggerDownload(`${baseName}.txt`, content, "text/plain;charset=utf-8");
      } else if (fmt === "md") {
        const content = buildExportText(detail, scenarios, "md");
        triggerDownload(
          `${baseName}.md`,
          content,
          "text/markdown;charset=utf-8",
        );
      } else {
        // PDF export requires a backend endpoint that's not specified yet.
        setExportNotice(
          "La exportación a PDF estará disponible próximamente. Por ahora podés exportar a Markdown o texto.",
        );
      }
    },
    [detail, scenarios],
  );

  const handleConfirmDelete = useCallback(async () => {
    const ok = await deleteSession();
    if (ok) {
      setDeleteOpen(false);
      router.push("/app/sessions");
    }
  }, [deleteSession, router]);

  const transcriptsCount = useMemo(
    () =>
      detail
        ? detail.transcripts.filter((t) => t.isFinal).length
        : 0,
    [detail],
  );
  const hintsCount = detail?.hints.length ?? 0;
  const speakersCount = detail?.speakers.length ?? 0;

  if (loading && !detail) {
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
        <span>Cargando sesión…</span>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
          maxWidth: 720,
        }}
      >
        <Card
          style={{
            background: "var(--color-amber)",
            color: "var(--color-amber-ink)",
          }}
        >
          <p style={{ margin: 0, fontWeight: 600 }}>
            {error ?? "No encontramos la sesión."}
          </p>
        </Card>
      </div>
    );
  }

  const sessionTitle = sessionTitleOrFallback(
    detail.session.title,
    detail.session.scenario,
    detail.session.startedAt,
    scenarios,
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1100,
      }}
    >
      <SessionDetailHero
        session={detail.session}
        scenarios={scenarios}
        onBack={goBack}
        actions={
          <SessionActionsMenu
            onShare={handleShareOpen}
            onExport={handleExport}
            onDelete={() => setDeleteOpen(true)}
          />
        }
      />

      {exportNotice ? (
        <p
          role="status"
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-text-mid)",
            background: "var(--color-bg-soft)",
            border: "1px solid var(--color-border)",
            padding: "10px 14px",
            borderRadius: 12,
          }}
        >
          {exportNotice}
        </p>
      ) : null}

      <SessionTabs
        active={activeTab}
        onChange={setActiveTab}
        panelIdFor={(k) => `panel-${k}`}
        tabs={[
          { key: "resumen", label: "Resumen" },
          { key: "transcripts", label: "Transcripts", count: transcriptsCount },
          { key: "hints", label: "Sugerencias", count: hintsCount },
          { key: "speakers", label: "Hablantes", count: speakersCount },
        ]}
      >
        <section
          role="tabpanel"
          id={`panel-${activeTab}`}
          aria-labelledby={`tab-${activeTab}`}
        >
          {activeTab === "resumen" ? (
            <SessionResumenTab
              session={detail.session}
              regenerating={regenerating}
              regenerateError={regenerateError}
              onRegenerate={() => void regenerateSummary()}
            />
          ) : null}
          {activeTab === "transcripts" ? (
            <SessionTranscriptsTab
              transcripts={detail.transcripts}
              speakers={detail.speakers}
            />
          ) : null}
          {activeTab === "hints" ? (
            <SessionHintsTab
              hints={detail.hints}
              transcripts={detail.transcripts}
            />
          ) : null}
          {activeTab === "speakers" ? (
            <SessionSpeakersTab
              sessionId={id}
              speakers={detail.speakers}
              onRefresh={refresh}
            />
          ) : null}
        </section>
      </SessionTabs>

      <ShareLinkModal
        open={shareOpen}
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
        onClose={() => setShareOpen(false)}
      />

      <DeleteSessionModal
        open={deleteOpen}
        title={sessionTitle}
        deleting={deleting}
        errorMessage={deleteError}
        onConfirm={() => void handleConfirmDelete()}
        onClose={() => setDeleteOpen(false)}
      />

      <style>{`
        @keyframes auri-blink {
          0%, 60% { opacity: 1; }
          80% { opacity: 0.25; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  );
}
