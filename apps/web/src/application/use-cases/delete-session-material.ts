/**
 * DeleteSessionMaterialUseCase — remove a single material from a session.
 */

import type { SessionMaterialsApiPort } from "@/application/ports/session-materials-api.port";

export class DeleteSessionMaterialUseCase {
  constructor(private readonly api: SessionMaterialsApiPort) {}

  execute(sessionId: string, materialId: number): Promise<void> {
    return this.api.delete(sessionId, materialId);
  }
}
