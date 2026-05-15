/**
 * CreateSessionUseCase — POST /api/sessions.
 *
 * Returns the freshly-created Session (with backend-assigned UUID).
 */

import type {
  CreateSessionInput,
  SessionsApiPort,
} from "@/application/ports/sessions-api.port";
import type { Session } from "@/domain/entities/session";

export class CreateSessionUseCase {
  constructor(private readonly api: SessionsApiPort) {}

  execute(input: CreateSessionInput): Promise<Session> {
    return this.api.create(input);
  }
}
