"use client";

/**
 * SessionTabs — simple ButtonGroup-style tab switcher for the 4 detail
 * tabs (Resumen / Transcripts / Sugerencias / Hablantes).
 *
 * The design system doesn't ship a Tabs primitive, so we build it from
 * Pill primitives styled as a horizontal segmented control. A11Y: each tab
 * is a `<button role="tab">`, the active one carries `aria-selected="true"`
 * and `aria-controls` pointing at the panel id.
 */

import type { JSX, ReactNode } from "react";

export type SessionTabKey = "resumen" | "transcripts" | "hints" | "speakers";

interface TabSpec {
  key: SessionTabKey;
  label: string;
  count?: number;
}

interface SessionTabsProps {
  active: SessionTabKey;
  onChange: (key: SessionTabKey) => void;
  tabs: TabSpec[];
  panelIdFor: (key: SessionTabKey) => string;
  children: ReactNode;
}

export function SessionTabs({
  active,
  onChange,
  tabs,
  panelIdFor,
  children,
}: SessionTabsProps): JSX.Element {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <div
        role="tablist"
        aria-label="Secciones de la sesión"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 6,
          borderBottom: "1px solid var(--color-border)",
          paddingBottom: 10,
        }}
      >
        {tabs.map((t) => {
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              id={`tab-${t.key}`}
              aria-selected={isActive}
              aria-controls={panelIdFor(t.key)}
              onClick={() => onChange(t.key)}
              style={{
                all: "unset",
                cursor: "pointer",
                padding: "8px 14px",
                borderRadius: 9999,
                fontFamily: "var(--font-dm-sans), system-ui, sans-serif",
                fontSize: 13,
                fontWeight: 700,
                letterSpacing: "0.3px",
                color: isActive ? "var(--color-lime-ink)" : "var(--color-text)",
                background: isActive
                  ? "var(--color-lime)"
                  : "transparent",
                border: `1px solid ${
                  isActive ? "transparent" : "var(--color-border)"
                }`,
                transition: "background 120ms ease, border-color 120ms ease",
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              <span>{t.label}</span>
              {t.count !== undefined && t.count > 0 ? (
                <span
                  aria-hidden="true"
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    background: isActive
                      ? "rgba(0,0,0,0.18)"
                      : "var(--color-bg-soft)",
                    color: isActive
                      ? "var(--color-lime-ink)"
                      : "var(--color-text-mid)",
                    padding: "2px 7px",
                    borderRadius: 999,
                    lineHeight: 1.1,
                  }}
                >
                  {t.count}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      {children}
    </div>
  );
}
