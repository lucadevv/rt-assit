/**
 * Auri StatCard — large numeric display on a colored fill.
 *
 * Specs:
 *  - bg color full
 *  - número 38px peso 700
 *  - label/caption mid weight
 */

import clsx from "clsx";
import type { CSSProperties, JSX, ReactNode } from "react";

export type StatCardTone = "lime" | "cyan" | "lavender" | "amber" | "dark" | "neutral";

interface StatCardProps {
  value: ReactNode;
  label: ReactNode;
  caption?: ReactNode;
  tone?: StatCardTone;
  className?: string;
}

const toneStyle: Record<StatCardTone, CSSProperties> = {
  lime: { background: "var(--color-lime)", color: "var(--color-lime-ink)" },
  cyan: { background: "var(--color-cyan)", color: "var(--color-cyan-ink)" },
  lavender: { background: "var(--color-lavender)", color: "var(--color-lavender-ink)" },
  amber: { background: "var(--color-amber)", color: "var(--color-amber-ink)" },
  dark: { background: "var(--color-black)", color: "var(--color-lime)" },
  neutral: { background: "var(--color-bg-soft)", color: "var(--color-text)" },
};

export function StatCard({
  value,
  label,
  caption,
  tone = "lime",
  className,
}: StatCardProps): JSX.Element {
  const style: CSSProperties = {
    ...toneStyle[tone],
    borderRadius: 22,
    padding: 24,
    display: "flex",
    flexDirection: "column",
    justifyContent: "space-between",
    minHeight: 160,
    border: "1px solid transparent",
  };
  return (
    <div className={clsx("auri-stat-card", className)} style={style}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: "0.6px", textTransform: "uppercase", opacity: 0.78 }}>
        {label}
      </div>
      <div style={{ fontSize: 38, fontWeight: 700, letterSpacing: "-1.4px", lineHeight: 1.04 }}>
        {value}
      </div>
      {caption ? (
        <div style={{ fontSize: 13, opacity: 0.75, fontWeight: 500 }}>{caption}</div>
      ) : null}
    </div>
  );
}
