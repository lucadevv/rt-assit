"use client";

/**
 * SkipToContent — keyboard-only "Skip to main content" link (WCAG 2.4.1).
 *
 * Visually hidden by default (positioned offscreen). When a sighted
 * keyboard user presses Tab from the URL bar, this is the FIRST focusable
 * element on every page; it jumps the user past the global TopBar +
 * Sidebar straight to the page's main content.
 *
 * Styling is inline (no Tailwind class) so the component works regardless
 * of theme / CSS pipeline state — accessibility primitives must never
 * silently fail due to a missing utility.
 */

import { useState, type CSSProperties, type JSX } from "react";

const HIDDEN_STYLE: CSSProperties = {
  position: "absolute",
  left: "-9999px",
  top: 0,
  zIndex: 9999,
  padding: "10px 18px",
  background: "var(--color-lime)",
  color: "var(--color-lime-ink)",
  fontWeight: 800,
  fontSize: 13,
  borderRadius: 12,
  boxShadow: "0 8px 22px rgba(8, 6, 22, 0.2)",
  textDecoration: "none",
};

const VISIBLE_STYLE: CSSProperties = {
  ...HIDDEN_STYLE,
  left: 12,
  top: 12,
};

export function SkipToContent(): JSX.Element {
  const [focused, setFocused] = useState(false);

  return (
    <a
      href="#main-content"
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={focused ? VISIBLE_STYLE : HIDDEN_STYLE}
    >
      Saltar al contenido principal
    </a>
  );
}
