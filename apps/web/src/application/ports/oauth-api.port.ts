/**
 * OAuthApiPort — application contract for the Meeting Frame OAuth REST
 * surface.
 *
 * Backend reference (Sprint 1 onward — `python_backend/app/presentation/api/oauth_router.py`):
 *   GET  /api/oauth/connected              → ConnectedIntegration[]
 *   GET  /api/oauth/{provider}/authorize   → { authorization_url, state }
 *   GET  /api/oauth/{provider}/callback    → redirects to /oauth-callback
 *   POST /api/oauth/{provider}/revoke      → { revoked, provider }
 *
 * Why a port:
 *  - Use cases consume this interface, not the concrete adapter, keeping
 *    them mockable for unit tests (Clean Arch mandate).
 *  - The adapter handles snake_case ↔ camelCase mapping and the
 *    `isExpired` computation at the boundary.
 *
 * Note on `getAuthorizationUrl`:
 *   The backend route is `GET /authorize` (NOT `POST`) and returns
 *   `{ authorization_url, state }`. We only surface `url` to the use
 *   case — `state` is server-stored for CSRF validation and the
 *   frontend never needs to inspect it.
 */

import type {
  OAuthProviderId,
  ConnectedIntegration,
} from "@/domain/entities/oauth-integration";

export interface OAuthApiPort {
  listConnected(): Promise<ConnectedIntegration[]>;
  getAuthorizationUrl(provider: OAuthProviderId): Promise<{ url: string }>;
  revoke(provider: OAuthProviderId): Promise<void>;
}
