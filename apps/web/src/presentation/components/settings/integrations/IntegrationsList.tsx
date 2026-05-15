"use client";

/**
 * IntegrationsList — orchestrates one `IntegrationCard` per provider.
 *
 * Consumes `useIntegrations()` for state + actions. Renders a loading
 * skeleton during the first fetch and an error banner on failure (without
 * crashing — the empty list still renders so the user can retry).
 */

import { type JSX } from "react";
import { useIntegrations } from "@/presentation/hooks/use-integrations";
import {
  PROVIDER_METADATA,
  type OAuthProviderId,
} from "@/domain/entities/oauth-integration";
import { IntegrationCard } from "./IntegrationCard";

const PROVIDER_ORDER: readonly OAuthProviderId[] = [
  "google",
  "microsoft",
  "zoom",
];

export function IntegrationsList(): JSX.Element {
  const { integrations, loading, error, hasFetched, popupOpen, connect, disconnect } =
    useIntegrations();

  const integrationByProvider = new Map(
    integrations.map((i) => [i.provider, i] as const),
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {error ? (
        <div
          role="alert"
          style={{
            background: "rgba(220, 38, 38, 0.08)",
            border: "1px solid rgba(220, 38, 38, 0.4)",
            borderRadius: 14,
            padding: "12px 16px",
            color: "var(--color-text)",
            fontSize: 13,
          }}
        >
          {error}
        </div>
      ) : null}

      {!hasFetched || loading ? (
        <div
          style={{
            color: "var(--color-text-mid)",
            fontSize: 14,
            padding: 16,
          }}
        >
          Cargando integraciones…
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          {PROVIDER_ORDER.map((id) => {
            const meta = PROVIDER_METADATA[id];
            const integration = integrationByProvider.get(id);
            return (
              <IntegrationCard
                key={id}
                provider={meta}
                integration={integration}
                disabled={popupOpen}
                onConnect={() => {
                  void connect(id);
                }}
                onDisconnect={() => {
                  void disconnect(id).catch(() => {
                    /* Already surfaced via store error. */
                  });
                }}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
