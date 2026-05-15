/**
 * IntegrationsApiPort — application contract for GET /api/integrations
 * (B4 placeholder; OAuth flows ship in a future phase).
 *
 * Credentials are NEVER part of this contract — the backend domain entity
 * doesn't expose them either, so leaks are impossible by construction.
 */

export interface IntegrationListItem {
  provider: string;
  status: string;
  metadata: Record<string, unknown>;
  connectedAt: string | null;
  disconnectedAt: string | null;
}

export interface IntegrationsApiPort {
  list(): Promise<IntegrationListItem[]>;
}
