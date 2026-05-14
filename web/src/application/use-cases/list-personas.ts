/**
 * ListPersonasUseCase — fetch the user's personas catalog.
 */

import type { PersonasApiPort } from "@/application/ports/personas-api.port";
import type { Persona } from "@/domain/entities/persona";

export class ListPersonasUseCase {
  constructor(private readonly api: PersonasApiPort) {}

  execute(): Promise<Persona[]> {
    return this.api.list();
  }
}
