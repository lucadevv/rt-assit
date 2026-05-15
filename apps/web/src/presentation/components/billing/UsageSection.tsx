"use client";

/**
 * UsageSection — 3 progress bars showing the user's consumption for the
 * current billing period:
 *  - Minutos transcribidos (vs max_minutes_per_month)
 *  - Sesiones (count, no hard cap; treated as "unlimited" for paid)
 *  - Documentos (vs max_docs)
 *
 * Color thresholds match `usageColors`:
 *   <50%   = lima (healthy)
 *   50-80% = amber
 *   >80%   = danger red
 *
 * When the cap is null (Pro+ on most resources) the bar fills with lime
 * and shows "Ilimitado" instead of a percentage.
 */

import type { JSX } from "react";
import { Card, Pill } from "@/design-system/primitives";
import type { Plan } from "@/domain/entities/plan";
import type { Usage } from "@/domain/entities/usage";
import { usageColors } from "./utils";

interface UsageSectionProps {
  usage: Usage | null;
  currentPlan: Plan | null;
}

interface BarProps {
  label: string;
  used: number;
  cap: number | null;
  unit: string;
  /** Pretty label override for unlimited (default: "Ilimitado"). */
  unlimitedLabel?: string;
}

function UsageBar({
  label,
  used,
  cap,
  unit,
  unlimitedLabel = "Ilimitado",
}: BarProps): JSX.Element {
  const isUnlimited = cap === null;
  const pct = isUnlimited
    ? 100
    : cap === 0
      ? 0
      : Math.min(100, Math.round((used / cap) * 100));
  const colors = isUnlimited
    ? { fill: "var(--color-lime)", background: "var(--color-bg-soft)" }
    : usageColors(pct);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: 8,
        }}
      >
        <span
          style={{ fontSize: 13, fontWeight: 600, color: "var(--color-text)" }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 12,
            fontFamily: "var(--font-jetbrains-mono), ui-monospace, monospace",
            color: "var(--color-text-mid)",
          }}
        >
          {isUnlimited
            ? `${used.toLocaleString("es-419")} ${unit} · ${unlimitedLabel}`
            : `${used.toLocaleString("es-419")} / ${cap.toLocaleString("es-419")} ${unit}`}
          {!isUnlimited ? <span style={{ marginLeft: 6 }}>· {pct}%</span> : null}
        </span>
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={isUnlimited ? 100 : cap ?? 0}
        aria-valuenow={isUnlimited ? 100 : Math.min(used, cap ?? 0)}
        aria-label={label}
        style={{
          height: 8,
          width: "100%",
          background: colors.background,
          borderRadius: 9999,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${pct}%`,
            background: colors.fill,
            borderRadius: 9999,
            transition: "width 200ms ease",
          }}
        />
      </div>
    </div>
  );
}

export function UsageSection({
  usage,
  currentPlan,
}: UsageSectionProps): JSX.Element {
  // Default caps if plan is unknown (e.g. mid-load or backend hiccup):
  // treat as Free-ish so users see numbers, not blanks.
  const minutesCap = currentPlan?.limits.max_minutes_per_month ?? 60;
  const docsCap = currentPlan?.limits.max_docs ?? 5;

  return (
    <section
      style={{ display: "flex", flexDirection: "column", gap: 12 }}
      aria-labelledby="usage-title"
    >
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            id="usage-title"
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.4px",
              color: "var(--color-text)",
            }}
          >
            Uso del mes
          </h2>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 13,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            Tu consumo del período actual. Se reinicia el primer día de cada mes.
          </p>
        </div>
        {!usage ? <Pill variant="ghost">Cargando…</Pill> : null}
      </header>

      <Card
        variant="default"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 18,
          padding: 20,
        }}
      >
        <UsageBar
          label="Minutos transcribidos"
          used={usage?.minutesUsed ?? 0}
          cap={currentPlan ? currentPlan.limits.max_minutes_per_month : minutesCap}
          unit="min"
        />
        <UsageBar
          label="Sesiones"
          used={usage?.sessionsCount ?? 0}
          cap={null}
          unit="sesiones"
        />
        <UsageBar
          label="Documentos"
          used={usage?.docsCount ?? 0}
          cap={currentPlan ? currentPlan.limits.max_docs : docsCap}
          unit="docs"
        />
      </Card>
    </section>
  );
}
