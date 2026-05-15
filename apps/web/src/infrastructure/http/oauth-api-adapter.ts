/**
 * OAuthApiAdapter — concrete `OAuthApiPort` impl backed by `ApiClient`.
 *
 * Backend reference (`python_backend/app/presentation/api/oauth_router.py`):
 *   GET  /api/oauth/connected              → list[{ provider, expires_at }]
 *   GET  /api/oauth/{provider}/authorize   → { authorization_url, state }
 *   POST /api/oauth/{provider}/revoke      → { revoked, provider }
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping.
 *  - Pre-compute `isExpired` at the boundary so the UI doesn't have to do
 *    time arithmetic at render-time.
 *  - For unsupported providers (microsoft / zoom in Sprint 1) the backend
 *    returns 501 — the adapter lets that bubble up as an `Error` and the
 *    presentation hook surfaces a friendly banner.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type { OAuthApiPort } from "@/application/ports/oauth-api.port";
import type {
  ConnectedIntegration,
  OAuthProviderId,
} from "@/domain/entities/oauth-integration";

interface ConnectedProviderRaw {
  provider: OAuthProviderId;
  expires_at: number;
}

interface AuthorizeResponseRaw {
  authorization_url: string;
  state: string;
}

interface RevokeResponseRaw {
  revoked: boolean;
  provider: OAuthProviderId;
}

function mapConnected(raw: ConnectedProviderRaw): ConnectedIntegration {
  return {
    provider: raw.provider,
    expiresAt: raw.expires_at,
    isExpired: raw.expires_at <= Date.now(),
  };
}

export class OAuthApiAdapter implements OAuthApiPort {
  constructor(private readonly api: ApiClient) {}

  async listConnected(): Promise<ConnectedIntegration[]> {
    const raw = await this.api.get<ConnectedProviderRaw[]>(
      "/api/oauth/connected",
    );
    return raw.map(mapConnected);
  }

  async getAuthorizationUrl(
    provider: OAuthProviderId,
  ): Promise<{ url: string }> {
    const raw = await this.api.get<AuthorizeResponseRaw>(
      `/api/oauth/${provider}/authorize`,
    );
    return { url: raw.authorization_url };
  }

  async revoke(provider: OAuthProviderId): Promise<void> {
    await this.api.post<RevokeResponseRaw>(
      `/api/oauth/${provider}/revoke`,
    );
  }
}

export const __testing = { mapConnected };
