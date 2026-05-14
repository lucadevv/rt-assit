"use client";

/**
 * SessionResumenTab — first tab. Shows `session.summary` + action items.
 *
 * Empty-state path:
 *   - When summary is null (the session ended but the LLM job didn't write
 *     one, or the session is still active), render a Spanish CTA card with
 *     a button that fires the regenerate-summary backend job.
 *
 * The actual regenerate handler is owned by the detail page (hooks back to
 * the use case). This component is presentational; it only takes props.
 */

import type { JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import type { Session } from "@/domain/entities/session";

interface SessionResumenTabProps {
  session: Session;
  regenerating: boolean;
  regenerateError: string | null;
  onRegenerate: () => void;
}

export function SessionResumenTab({
  session,
  regenerating,
  regenerateError,
  onRegenerate,
}: SessionResumenTabProps): JSX.Element {
  const hasSummary =
    session.summary !== null && session.summary.trim().length > 0;
  const hasActionItems = session.actionItems.length > 0;

  if (!hasSummary && !hasActionItems) {
    return (
      <Card
        variant="soft"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 14,
          alignItems: "flex-start",
        }}
      >
        <Pill variant="lavender">Resumen</Pill>
        <p
          style={{
            margin: 0,
            fontSize: 15,
            lineHeight: 1.55,
            color: "var(--color-text)",
            maxWidth: 560,
          }}
        >
          Esta sesión no tiene resumen todavía. Generá uno con IA — toma
          unos segundos.
        </p>
        {regenerateError ? (
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
            {regenerateError}
          </p>
        ) : null}
        <Button
          variant="primary"
          size="md"
          disabled={regenerating}
          onClick={onRegenerate}
        >
          {regenerating ? "Generando…" : "Generar resumen"}
        </Button>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      <Card
        variant="soft"
        style={{ display: "flex", flexDirection: "column", gap: 12 }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            flexWrap: "wrap",
          }}
        >
          <Pill variant="lavender">Resumen</Pill>
          {regenerating ? (
            <span style={{ fontSize: 11, color: "var(--color-text-mid)" }}>
              Regenerando con IA…
            </span>
          ) : null}
          <span style={{ flex: 1 }} />
          <Button
            variant="ghost"
            size="sm"
            disabled={regenerating}
            onClick={onRegenerate}
          >
            {regenerating ? "Regenerando…" : "Regenerar"}
          </Button>
        </div>
        {hasSummary ? (
          <p
            style={{
              margin: 0,
              fontSize: 15,
              lineHeight: 1.6,
              color: "var(--color-text)",
              whiteSpace: "pre-wrap",
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
        {regenerateError ? (
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
            {regenerateError}
          </p>
        ) : null}
      </Card>

      {hasActionItems ? (
        <Card style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Pill variant="cyan">Action items</Pill>
          <ul
            style={{
              margin: 0,
              paddingLeft: 20,
              fontSize: 14,
              color: "var(--color-text)",
              lineHeight: 1.6,
              display: "flex",
              flexDirection: "column",
              gap: 4,
            }}
          >
            {session.actionItems.map((item, idx) => (
              <li key={`${idx}-${item.slice(0, 6)}`}>{item}</li>
            ))}
          </ul>
        </Card>
      ) : null}
    </div>
  );
}
