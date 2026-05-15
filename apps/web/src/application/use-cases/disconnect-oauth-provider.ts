/**
 * DisconnectOAuthProviderUseCase — revoke the user's credential for a
 * given provider.
 *
 * Backend semantics: best-effort revoke at the provider, then delete the
 * local credential row. Even if the provider revoke fails (e.g. already
 * revoked), the local row is removed.
 */

import type { OAuthApiPort } from "@/application/ports/oauth-api.port";
import type { OAuthProviderId } from "@/domain/entities/oauth-integration";

export class DisconnectOAuthProviderUseCase {
  constructor(private readonly api: OAuthApiPort) {}

  execute(provider: OAuthProviderId): Promise<void> {
    return this.api.revoke(provider);
  }
}
