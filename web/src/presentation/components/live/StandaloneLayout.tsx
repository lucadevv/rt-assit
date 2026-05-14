"use client";

/**
 * StandaloneLayout — default layout: 60/40 split, transcripts on the
 * left, hints + agent on the right. The outer container uses the
 * scenario color for its border, picking up the brand semantics.
 */

import type { JSX } from "react";
import { Card } from "@/design-system/primitives";
import { TranscriptArea } from "./TranscriptArea";
import { HintArea } from "./HintArea";
import { useScenarioStore } from "@/application/stores/scenario.store";
import { scenarioColorOf } from "@/domain/entities/scenario";

const colorVar: Record<
  ReturnType<typeof scenarioColorOf>,
  { border: string; bg: string }
> = {
  cyan: { border: "var(--color-cyan)", bg: "var(--color-cyan)" },
  amber: { border: "var(--color-amber)", bg: "var(--color-amber)" },
  lavender: { border: "var(--color-lavender)", bg: "var(--color-lavender)" },
  lime: { border: "var(--color-lime)", bg: "var(--color-lime)" },
};

export function StandaloneLayout(): JSX.Element {
  const scenarioId = useScenarioStore((s) => s.current);
  const accent = scenarioId ? scenarioColorOf(scenarioId) : "lime";
  const accentBorder = colorVar[accent].border;

  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gridTemplateColumns: "minmax(0, 3fr) minmax(0, 2fr)",
        gap: 16,
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
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 18px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--color-text-mid)",
            }}
          >
            Transcripción
          </span>
        </header>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "18px 22px 24px",
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
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 18px",
            borderBottom: "1px solid var(--color-border)",
          }}
        >
          <span
            style={{
              fontFamily: "var(--font-jetbrains, ui-monospace), monospace",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.6px",
              textTransform: "uppercase",
              color: "var(--color-text-mid)",
            }}
          >
            Auri
          </span>
        </header>
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: "auto",
            padding: "18px 22px 24px",
          }}
        >
          <HintArea />
        </div>
      </Card>
    </div>
  );
}
