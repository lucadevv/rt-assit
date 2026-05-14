/**
 * IntegrationsApiAdapter — concrete `IntegrationsApiPort` implementation.
 *
 * Backend reference (B4 placeholder):
 *  - GET /api/integrations → list[IntegrationResponse]
 *
 * Currently returns an empty list for every user. The endpoint exists so
 * the Settings UI ("Próximamente" cards) can fetch it without scaffolding
 * special-case logic when OAuth flows ship later.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  IntegrationListItem,
  IntegrationsApiPort,
} from "@/application/ports/integrations-api.port";

interface IntegrationRaw {
  provider: string;
  status: string;
  metadata: Record<string, unknown> | null;
  connected_at: string | null;
  disconnected_at: string | null;
}

function map(raw: IntegrationRaw): IntegrationListItem {
  return {
    provider: raw.provider,
    status: raw.status,
    metadata: raw.metadata ?? {},
    connectedAt: raw.connected_at,
    disconnectedAt: raw.disconnected_at,
  };
}

export class IntegrationsApiAdapter implements IntegrationsApiPort {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<IntegrationListItem[]> {
    const raw = await this.api.get<IntegrationRaw[]>("/api/integrations");
    return raw.map(map);
  }
}

export const __testing = { map };
