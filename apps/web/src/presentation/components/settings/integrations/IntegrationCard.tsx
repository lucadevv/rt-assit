"use client";

/**
 * IntegrationCard — single provider card in the Integrations page grid.
 *
 * States:
 *  - available + not connected  → "Conectar" primary CTA + "No conectado" pill
 *  - available + connected      → "Desconectar" danger ghost + "Conectado" pill + expiry hint
 *  - not available (sprint 2/3) → "Próximamente" pill, disabled CTA
 *
 * Disabled while another connect popup is in flight (popupOpen elsewhere).
 */

import { type JSX } from "react";
import { Button, Card, Pill } from "@/design-system/primitives";
import type {
  ConnectedIntegration,
  ProviderMetadata,
} from "@/domain/entities/oauth-integration";

interface IntegrationCardProps {
  provider: ProviderMetadata;
  integration: ConnectedIntegration | undefined;
  disabled: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}

function formatExpiry(ms: number): string {
  try {
    const d = new Date(ms);
    return d.toLocaleString("es-AR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return new Date(ms).toISOString();
  }
}

export function IntegrationCard({
  provider,
  integration,
  disabled,
  onConnect,
  onDisconnect,
}: IntegrationCardProps): JSX.Element {
  const connected = integration !== undefined && !integration.isExpired;
  const expired = integration !== undefined && integration.isExpired;

  let pill: JSX.Element;
  if (!provider.available) {
    pill = <Pill variant="ghost">Próximamente</Pill>;
  } else if (connected) {
    pill = <Pill variant="lime">Conectado</Pill>;
  } else if (expired) {
    pill = <Pill variant="amber">Expirado</Pill>;
  } else {
    pill = <Pill variant="ghost">No conectado</Pill>;
  }

  return (
    <Card
      variant="default"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 12,
        flex: "1 1 260px",
        minWidth: 260,
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
        <h3
          style={{
            margin: 0,
            fontSize: 16,
            fontWeight: 700,
            color: "var(--color-text)",
            letterSpacing: "-0.2px",
          }}
        >
          {provider.displayName}
        </h3>
        {pill}
      </div>

      <p
        style={{
          margin: 0,
          fontSize: 14,
          color: "var(--color-text-mid)",
          lineHeight: 1.5,
        }}
      >
        {provider.description}
      </p>

      {connected && integration ? (
        <p
          className="mono"
          style={{
            margin: 0,
            fontSize: 11,
            color: "var(--color-text-dim)",
            letterSpacing: "0.4px",
          }}
        >
          Expira: {formatExpiry(integration.expiresAt)}
        </p>
      ) : null}

      <div style={{ marginTop: "auto" }}>
        {!provider.available ? (
          <Button
            variant="ghost"
            size="sm"
            disabled
            aria-disabled="true"
            title="Próximamente"
          >
            Conectar
          </Button>
        ) : connected ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={disabled}
            onClick={onDisconnect}
          >
            Desconectar
          </Button>
        ) : (
          <Button
            variant="primary"
            size="sm"
            disabled={disabled}
            onClick={onConnect}
          >
            {disabled ? "Conectando…" : "Conectar"}
          </Button>
        )}
      </div>
    </Card>
  );
}
