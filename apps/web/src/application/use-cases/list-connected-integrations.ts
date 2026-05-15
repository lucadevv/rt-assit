/**
 * ListConnectedIntegrationsUseCase — fetch the user's connected OAuth
 * providers (Sprint 1+ Meeting Frame).
 */

import type { OAuthApiPort } from "@/application/ports/oauth-api.port";
import type { ConnectedIntegration } from "@/domain/entities/oauth-integration";

export class ListConnectedIntegrationsUseCase {
  constructor(private readonly api: OAuthApiPort) {}

  execute(): Promise<ConnectedIntegration[]> {
    return this.api.listConnected();
  }
}
