"use client";

/**
 * SidebarLayout — Pro+ functional command center.
 *
 * - Free tier: educational copy + UpgradeBanner pointing at Pro, plus
 *   shortcut buttons to switch to Standalone / PiP.
 * - Pro+ tier:
 *   - Main column: MeetMirror (live <video> of the captured tab) +
 *     AudioLevelMeter + CaptureControls.
 *   - Right column: TranscriptArea + HintArea (scenario-tinted borders).
 *
 * The MediaStream the mirror + meter consume is taken from the session
 * store (`currentStream`). `useLiveSession` always passes `keepVideo:
 * true` to the capture adapter, so the stream keeps its video tracks
 * alive regardless of which layout was active when the user pressed
 * "Iniciar captura" — switching layouts mid-session works seamlessly.
 */

import type { JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import { useScenarioStore } from "@/application/stores/scenario.store";
import { useTweaksStore } from "@/application/stores/tweaks.store";
import { useSessionStore } from "@/application/stores/session.store";
import {
  useScreenOcrStore,
  type ScreenOcrEntry,
} from "@/application/stores/screen-ocr.store";
import { scenarioColorOf } from "@/domain/entities/scenario";
import { useTierGate } from "@/presentation/hooks/use-tier-gate";
import { useScreenOcr } from "@/presentation/hooks/use-screen-ocr";
import { TranscriptArea } from "./TranscriptArea";
import { HintArea } from "./HintArea";
import { MeetMirror } from "./MeetMirror";
import { AudioLevelMeter } from "./AudioLevelMeter";
import { CaptureControls } from "./CaptureControls";
import { UpgradeBanner } from "@/presentation/components/billing/UpgradeBanner";

const accentVar: Record<
  ReturnType<typeof scenarioColorOf>,
  string
> = {
  cyan: "var(--color-cyan)",
  amber: "var(--color-amber)",
  lavender: "var(--color-lavender)",
  lime: "var(--color-lime)",
};

const SECTION_HEADER_STYLE = {
  padding: "12px 16px",
  borderBottom: "1px solid var(--color-border)",
  fontFamily: "var(--font-jetbrains, var(--font-mono)), monospace",
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.6px",
  textTransform: "uppercase" as const,
  color: "var(--color-text-mid)",
};

export function SidebarLayout(): JSX.Element {
  const scenarioId = useScenarioStore((s) => s.current);
  const accent = scenarioId ? scenarioColorOf(scenarioId) : "lime";
  const accentBorder = accentVar[accent];
  const setLayout = useTweaksStore((s) => s.setLayout);

  const tierGate = useTierGate("all_layouts");
  const isCapturing = useSessionStore((s) => s.isCapturing);
  // Subscribe to the live MediaStream directly from the session store.
  // This makes the mirror reactive to stream changes regardless of when
  // the sidebar layout was mounted (before vs after capture started) —
  // unlike a local useEffect+getStream() which only fires on mount or
  // when isCapturing toggles.
  const stream = useSessionStore((s) => s.currentStream);

  // OCR (G1) — no-op until the user flips the toggle in TweaksPanel.
  // Lazy-imports tesseract.js on first activation, so initial bundle
  // is unaffected.
  useScreenOcr(stream);
  const ocrEnabled = useScreenOcrStore((s) => s.enabled);
  const ocrEntries = useScreenOcrStore((s) => s.entries);

  // -------------------- Free tier — locked --------------------
  if (!tierGate.available) {
    return (
      <div
        style={{
          flex: 1,
          minHeight: 0,
          display: "grid",
          gridTemplateColumns: "minmax(0, 1fr) 380px",
          gap: 16,
        }}
      >
        <Card
          bordered
          padded
          variant="soft"
          style={{
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-start",
            justifyContent: "center",
            gap: 14,
            padding: "40px 32px",
          }}
        >
          <Pill variant="ghost">Modo sidebar · Pro</Pill>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.5px",
            }}
          >
            Modo sidebar — disponible en Pro
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              lineHeight: 1.6,
              color: "var(--color-text-mid)",
              maxWidth: 520,
            }}
          >
            En Pro, el modo sidebar muestra un preview en vivo de tu reunión
            (Meet, Zoom o Teams), un medidor de volumen y controles para
            pausar Susurra sin afectar la llamada.
          </p>
          <div style={{ width: "100%", maxWidth: 560 }}>
            <UpgradeBanner
              feature="el modo sidebar con preview en vivo"
              requiredTier={tierGate.requiredTier ?? "pro"}
            />
          </div>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: 13,
              color: "var(--color-text-mid)",
            }}
          >
            Mientras tanto, podés usar:
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Button variant="ghost" onClick={() => setLayout("standalone")}>
              Standalone
            </Button>
            <Button variant="primary" onClick={() => setLayout("pip")}>
              Picture-in-Picture →
            </Button>
          </div>
        </Card>

        <div
          style={{
            minHeight: 0,
            display: "grid",
            gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
            gap: 12,
          }}
        >
          <Card
            bordered
            padded={false}
            style={{
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              borderColor: accentBorder,
            }}
          >
            <header style={SECTION_HEADER_STYLE}>Transcripción</header>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "14px 18px 18px",
              }}
            >
              <TranscriptArea />
            </div>
          </Card>
          <Card
            bordered
            padded={false}
            style={{
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              borderColor: accentBorder,
            }}
          >
            <header style={SECTION_HEADER_STYLE}>Susurra</header>
            <div
              style={{
                flex: 1,
                minHeight: 0,
                overflowY: "auto",
                padding: "14px 18px 18px",
              }}
            >
              <HintArea />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // -------------------- Pro+ tier — functional --------------------
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) 380px",
        gap: 16,
      }}
    >
      <div
        style={{
          minHeight: 0,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          overflowY: "auto",
        }}
      >
        <MeetMirror stream={stream} />
        {isCapturing ? (
          <>
            <Card>
              <AudioLevelMeter stream={stream} />
            </Card>
            <CaptureControls />
          </>
        ) : null}
        {ocrEnabled ? <OcrDebugPanel entries={ocrEntries} /> : null}
      </div>

      <div
        style={{
          minHeight: 0,
          display: "grid",
          gridTemplateRows: "minmax(0, 1fr) minmax(0, 1fr)",
          gap: 12,
        }}
      >
        <Card
          bordered
          padded={false}
          style={{
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            borderColor: accentBorder,
          }}
        >
          <header style={SECTION_HEADER_STYLE}>Transcripción</header>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "14px 18px 18px",
            }}
          >
            <TranscriptArea />
          </div>
        </Card>

        <Card
          bordered
          padded={false}
          style={{
            minHeight: 0,
            display: "flex",
            flexDirection: "column",
            borderColor: accentBorder,
          }}
        >
          <header style={SECTION_HEADER_STYLE}>Susurra</header>
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "14px 18px 18px",
            }}
          >
            <HintArea />
          </div>
        </Card>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------
// OCR debug panel — temporary G1 visibility. G2 will replace this
// with real LLM-context wiring.
// ---------------------------------------------------------------

function formatTime(ms: number): string {
  const d = new Date(ms);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

function OcrDebugPanel({
  entries,
}: {
  entries: readonly ScreenOcrEntry[];
}): JSX.Element {
  return (
    <Card
      bordered
      padded={false}
      style={{
        display: "flex",
        flexDirection: "column",
      }}
    >
      <header style={SECTION_HEADER_STYLE}>OCR de pantalla (beta)</header>
      <div
        style={{
          padding: "12px 16px 14px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          maxHeight: 280,
          overflowY: "auto",
        }}
      >
        {entries.length === 0 ? (
          <div
            style={{
              fontSize: 12,
              color: "var(--color-text-dim)",
              lineHeight: 1.5,
            }}
          >
            Esperando texto en pantalla… (procesamos cada 5s)
          </div>
        ) : (
          entries.map((entry, idx) => (
            <div
              key={`${entry.capturedAt}-${idx}`}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 4,
                padding: "8px 10px",
                borderRadius: 8,
                background: "var(--color-bg)",
                border: "1px solid var(--color-border)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontFamily:
                    "var(--font-jetbrains, ui-monospace), monospace",
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: "0.4px",
                  textTransform: "uppercase",
                  color: "var(--color-text-mid)",
                }}
              >
                <span>{formatTime(entry.capturedAt)}</span>
                <span>{Math.round(entry.confidence * 100)}%</span>
              </div>
              <div
                style={{
                  fontSize: 12,
                  lineHeight: 1.45,
                  color: "var(--color-text)",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                }}
              >
                {truncate(entry.text, 200)}
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}
