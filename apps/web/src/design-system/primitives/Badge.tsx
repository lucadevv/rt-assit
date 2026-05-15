/**
 * Susurra Badge — status indicator. Smaller and stricter than Pill.
 *
 * Used for: live state (recording, paused), tier markers (Free/Pro/Premium),
 * scenario tags inside lists.
 */

import clsx from "clsx";
import type { CSSProperties, JSX, ReactNode } from "react";

export type BadgeTone = "neutral" | "success" | "warning" | "danger" | "info" | "lime";

interface BadgeProps {
  children: ReactNode;
  tone?: BadgeTone;
  dot?: boolean;
  className?: string;
}

const toneStyle: Record<BadgeTone, { bg: string; fg: string; dot: string }> = {
  neutral: {
    bg: "var(--color-bg-soft)",
    fg: "var(--color-text)",
    dot: "var(--color-text-mid)",
  },
  success: { bg: "oklch(94% 0.06 145)", fg: "oklch(28% 0.10 145)", dot: "oklch(58% 0.18 145)" },
  warning: { bg: "oklch(95% 0.06 80)", fg: "oklch(32% 0.13 70)", dot: "oklch(70% 0.18 80)" },
  danger: { bg: "oklch(94% 0.06 25)", fg: "oklch(32% 0.18 25)", dot: "oklch(58% 0.22 25)" },
  info: { bg: "oklch(94% 0.05 220)", fg: "oklch(28% 0.10 220)", dot: "oklch(58% 0.16 220)" },
  lime: { bg: "var(--color-lime)", fg: "var(--color-lime-ink)", dot: "var(--color-lime-ink)" },
};

export function Badge({
  children,
  tone = "neutral",
  dot = false,
  className,
}: BadgeProps): JSX.Element {
  const v = toneStyle[tone];
  const style: CSSProperties = {
    background: v.bg,
    color: v.fg,
    fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "0.2px",
    padding: "4px 10px",
    borderRadius: 9999,
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    lineHeight: 1.05,
  };
  return (
    <span className={clsx("susurra-badge", className)} style={style}>
      {dot ? (
        <span
          aria-hidden
          style={{
            width: 6,
            height: 6,
            borderRadius: 9999,
            background: v.dot,
            display: "inline-block",
          }}
        />
      ) : null}
      {children}
    </span>
  );
}
