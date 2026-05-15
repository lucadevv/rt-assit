"use client";

/**
 * IntegrationsSection — placeholder cards for Google Calendar / Slack /
 * Notion (FR-51).
 *
 * Backend already exposes GET /api/integrations (B4 placeholder, returns
 * an empty list). When OAuth flows ship in F-future we'll wire each card
 * to its connect/disconnect action and reflect the connected state.
 */

import { useEffect, useState, type JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import { useContainer } from "@/infrastructure/di/container";
import type { IntegrationListItem } from "@/application/ports/integrations-api.port";
import { SettingsSection } from "./SettingsSection";

interface ProviderMeta {
  id: string;
  label: string;
  description: string;
  /** Inline emoji as a tiny visual anchor; replaced by SVG when icons land. */
  glyph: string;
}

const PROVIDERS: readonly ProviderMeta[] = [
  {
    id: "google_calendar",
    label: "Google Calendar",
    description: "Importá tus reuniones y dejá que Susurra se prepare con vos.",
    glyph: "📅",
  },
  {
    id: "slack",
    label: "Slack",
    description: "Resúmenes y action items directos a tu canal.",
    glyph: "💬",
  },
  {
    id: "notion",
    label: "Notion",
    description: "Sincronizá tus notas y aparecen como contexto en sesión.",
    glyph: "📝",
  },
];

interface ProviderCardProps {
  provider: ProviderMeta;
  connected: boolean;
}

function ProviderCard({ provider, connected }: ProviderCardProps): JSX.Element {
  return (
    <Card
      variant="default"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flex: "1 1 220px",
        minWidth: 220,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <span
          aria-hidden="true"
          style={{
            fontSize: 24,
            lineHeight: 1,
          }}
        >
          {provider.glyph}
        </span>
        <Pill variant={connected ? "lime" : "ghost"}>
          {connected ? "Conectado" : "Próximamente"}
        </Pill>
      </div>
      <div>
        <h3
          style={{
            margin: 0,
            fontSize: 15,
            fontWeight: 700,
            color: "var(--color-text)",
          }}
        >
          {provider.label}
        </h3>
        <p
          style={{
            margin: "4px 0 0",
            fontSize: 13,
            color: "var(--color-text-mid)",
            lineHeight: 1.5,
          }}
        >
          {provider.description}
        </p>
      </div>
      <Button
        variant="ghost"
        size="sm"
        disabled
        aria-disabled="true"
        title="Próximamente"
      >
        {connected ? "Administrar" : "Conectar"}
      </Button>
    </Card>
  );
}

export function IntegrationsSection(): JSX.Element {
  const { listIntegrations } = useContainer();
  const [items, setItems] = useState<IntegrationListItem[]>([]);

  // Best-effort fetch — backend B4 always returns []. We surface the
  // connected state defensively so when OAuth lands the UI is ready.
  useEffect(() => {
    listIntegrations
      .execute()
      .then(setItems)
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console -- diagnostic only
        console.error("[susurra] failed to GET /api/integrations:", err);
      });
  }, [listIntegrations]);

  const isConnected = (providerId: string): boolean =>
    items.some((i) => i.provider === providerId && i.status === "connected");

  return (
    <SettingsSection
      title="Otras integraciones"
      description="Calendar, chat y notas — próximamente."
      bare
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        {PROVIDERS.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            connected={isConnected(p.id)}
          />
        ))}
      </div>
    </SettingsSection>
  );
}
