"use client";

/**
 * SettingsSection — visual wrapper for each settings section.
 *
 * Renders a sticky-feeling header (title + description + optional pill on
 * the right side) above a Card containing the actual form controls. Used
 * by every section component in `presentation/components/settings/` to
 * keep the visual rhythm consistent.
 */

import type { JSX, ReactNode } from "react";
import { Card } from "@/design-system/primitives";

interface SettingsSectionProps {
  title: string;
  description?: string;
  trailing?: ReactNode;
  children: ReactNode;
  cardVariant?: "default" | "soft" | "warm";
  /** Render the section without an internal Card (for full-bleed dangerous
   * zones that supply their own container). */
  bare?: boolean;
}

export function SettingsSection({
  title,
  description,
  trailing,
  children,
  cardVariant = "default",
  bare = false,
}: SettingsSectionProps): JSX.Element {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
      }}
    >
      <header
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 16,
          flexWrap: "wrap",
        }}
      >
        <div>
          <h2
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: "-0.4px",
              color: "var(--color-text)",
            }}
          >
            {title}
          </h2>
          {description ? (
            <p
              style={{
                margin: "4px 0 0",
                fontSize: 13,
                color: "var(--color-text-mid)",
                lineHeight: 1.5,
                maxWidth: 560,
              }}
            >
              {description}
            </p>
          ) : null}
        </div>
        {trailing ? <div>{trailing}</div> : null}
      </header>
      {bare ? children : <Card variant={cardVariant}>{children}</Card>}
    </section>
  );
}

interface SettingsRowProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  /** Renders the row in a stacked layout (label above control). */
  stacked?: boolean;
}

export function SettingsRow({
  label,
  hint,
  htmlFor,
  children,
  stacked = false,
}: SettingsRowProps): JSX.Element {
  if (stacked) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label
          htmlFor={htmlFor}
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          {label}
        </label>
        {children}
        {hint ? (
          <p
            style={{
              margin: 0,
              fontSize: 12,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            {hint}
          </p>
        ) : null}
      </div>
    );
  }
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 16,
        padding: "10px 0",
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: "1 1 220px", minWidth: 200 }}>
        <label
          htmlFor={htmlFor}
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: "var(--color-text)",
          }}
        >
          {label}
        </label>
        {hint ? (
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 12,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            {hint}
          </p>
        ) : null}
      </div>
      <div style={{ flex: "0 1 320px", minWidth: 200 }}>{children}</div>
    </div>
  );
}
