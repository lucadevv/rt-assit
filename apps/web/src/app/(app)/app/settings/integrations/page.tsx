"use client";

/**
 * Integrations (/app/settings/integrations) — Sprint 1 Meeting Frame.
 *
 * Lists every meeting provider Susurra supports (Google Meet, Teams,
 * Zoom) and lets the user connect / disconnect their accounts via the
 * popup-based OAuth flow.
 *
 * Sub-page of /app/settings (sibling, not a tab) — chosen by the user
 * to keep the main Settings page focused on Perfil / Audio / etc., and
 * to give the meeting integrations room to grow (per-account scopes,
 * multi-tenant configuration in later sprints).
 *
 * The page itself is a Client Component because it composes Zustand
 * state via `useIntegrations()`. The interactive grid lives in the
 * `IntegrationsList` client island.
 */

import { type JSX } from "react";
import Link from "next/link";
import { Pill } from "@/design-system/primitives";
import { IntegrationsList } from "@/presentation/components/settings/integrations/IntegrationsList";

export default function IntegrationsPage(): JSX.Element {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 24,
        maxWidth: 1100,
      }}
    >
      <header
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link
            href="/app/settings"
            style={{
              fontSize: 12,
              color: "var(--color-text-mid)",
              textDecoration: "none",
            }}
          >
            ← Configuración
          </Link>
          <Pill variant="lavender">Meeting Frame · Sprint 1</Pill>
        </div>
        <h1
          style={{
            fontSize: 38,
            fontWeight: 700,
            letterSpacing: "-1.4px",
            margin: 0,
          }}
        >
          Tus <span className="italic-accent">integraciones</span>
        </h1>
        <p
          style={{
            color: "var(--color-text-mid)",
            fontSize: 16,
            maxWidth: 640,
            margin: 0,
            lineHeight: 1.5,
          }}
        >
          Conectá tus cuentas para que Susurra se una a tus reuniones.
        </p>
      </header>

      <IntegrationsList />
    </div>
  );
}
