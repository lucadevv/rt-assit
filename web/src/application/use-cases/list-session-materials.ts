/**
 * ListSessionMaterialsUseCase — fetch the ad-hoc materials attached to
 * a session row.
 */

import type { SessionMaterialsApiPort } from "@/application/ports/session-materials-api.port";
import type { SessionMaterial } from "@/domain/entities/session-material";

export class ListSessionMaterialsUseCase {
  constructor(private readonly api: SessionMaterialsApiPort) {}

  execute(sessionId: string): Promise<SessionMaterial[]> {
    return this.api.list(sessionId);
  }
}
