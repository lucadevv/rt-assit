"use client";

/**
 * RecordingsEmptyState — two flavours:
 *
 *   mode="upgrade"  → user is on Free tier; we render the UpgradeBanner
 *                     with copy specific to recordings.
 *   mode="empty"    → user is on Pro+ but has no recordings yet; we
 *                     render an aspirational "next session will appear
 *                     here" card with a CTA back to /app/live.
 */

import { useState, type JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import { ArrowRightIcon } from "@/design-system/icons";
import { UpgradeBanner } from "@/presentation/components/billing/UpgradeBanner";
import { NewSessionModal } from "@/presentation/components/sessions/NewSessionModal";
import type { RequiredTier } from "@/application/use-cases/check-feature-availability";

interface RecordingsEmptyStateProps {
  mode: "upgrade" | "empty";
  requiredTier?: RequiredTier;
}

export function RecordingsEmptyState({
  mode,
  requiredTier,
}: RecordingsEmptyStateProps): JSX.Element {
  const [open, setOpen] = useState(false);

  if (mode === "upgrade" && requiredTier) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 16,
        }}
      >
        <UpgradeBanner
          feature="grabaciones de sesiones"
          requiredTier={requiredTier}
          description="Las grabaciones quedan disponibles desde el plan Pro: replay con transcript sincronizado, share links y exportes."
        />
        <Card
          variant="soft"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 8,
          }}
        >
          <Pill variant="ghost">Por qué importa</Pill>
          <h2
            style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 700,
              letterSpacing: "-0.6px",
            }}
          >
            Tu historia conversacional, searchable
          </h2>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "var(--color-text-mid)",
              lineHeight: 1.5,
            }}
          >
            Volvé a tus entrevistas, reuniones y exámenes con audio
            sincronizado al transcript. Ideal para revisar respuestas,
            pulir feedback y compartir momentos clave con tu equipo.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <Card
      variant="soft"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        textAlign: "center" as const,
        padding: 32,
      }}
    >
      <Pill variant="ghost">Sin grabaciones todavía</Pill>
      <h2
        style={{
          margin: 0,
          fontSize: 22,
          fontWeight: 700,
          letterSpacing: "-0.6px",
        }}
      >
        Acá van a aparecer tus sesiones grabadas
      </h2>
      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--color-text-mid)",
          lineHeight: 1.5,
          maxWidth: 460,
          marginInline: "auto",
        }}
      >
        Cuando termines una sesión con grabación activada, aparece acá
        con su transcript sincronizado y opción de compartir.
      </p>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <Button
          variant="primary"
          size="md"
          trailingIcon={<ArrowRightIcon size={16} />}
          onClick={() => setOpen(true)}
        >
          Empezar una sesión
        </Button>
      </div>
      <NewSessionModal open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}
