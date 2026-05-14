/**
 * CreateSessionMaterialUseCase — POST a new material onto a session row.
 *
 * The NewSessionModal collects materials in local state and fires this
 * use case once per material AFTER the session row has been created.
 */

import type {
  CreateSessionMaterialInput,
  SessionMaterialsApiPort,
} from "@/application/ports/session-materials-api.port";
import type { SessionMaterial } from "@/domain/entities/session-material";

export class CreateSessionMaterialUseCase {
  constructor(private readonly api: SessionMaterialsApiPort) {}

  execute(
    sessionId: string,
    input: CreateSessionMaterialInput,
  ): Promise<SessionMaterial> {
    return this.api.create(sessionId, input);
  }
}
