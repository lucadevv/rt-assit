/**
 * ListIntegrationsUseCase — GET /api/integrations.
 *
 * Returns the list of third-party integrations connected to the user's
 * account. F6 only renders this for the placeholder "Próximamente"
 * cards; OAuth flows that actually connect providers ship later.
 */

import type {
  IntegrationListItem,
  IntegrationsApiPort,
} from "@/application/ports/integrations-api.port";

export class ListIntegrationsUseCase {
  constructor(private readonly api: IntegrationsApiPort) {}

  execute(): Promise<IntegrationListItem[]> {
    return this.api.list();
  }
}
