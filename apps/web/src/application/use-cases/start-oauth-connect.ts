/**
 * StartOAuthConnectUseCase — return the consent-screen URL the caller
 * should open in a popup.
 *
 * The use case does NOT open the popup itself — that's a presentation
 * concern (it needs `window.open` and event listeners). This use case
 * only orchestrates the backend call.
 */

import type { OAuthApiPort } from "@/application/ports/oauth-api.port";
import type { OAuthProviderId } from "@/domain/entities/oauth-integration";

export class StartOAuthConnectUseCase {
  constructor(private readonly api: OAuthApiPort) {}

  execute(provider: OAuthProviderId): Promise<{ url: string }> {
    return this.api.getAuthorizationUrl(provider);
  }
}
