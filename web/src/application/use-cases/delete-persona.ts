/**
 * DeletePersonaUseCase — remove a persona by id.
 *
 * Presentation layer is expected to ask for confirmation.
 */

import type { PersonasApiPort } from "@/application/ports/personas-api.port";

export class DeletePersonaUseCase {
  constructor(private readonly api: PersonasApiPort) {}

  execute(id: number): Promise<void> {
    return this.api.delete(id);
  }
}
