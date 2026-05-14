/**
 * GetPersonaUseCase — fetch a single persona by id.
 */

import type { PersonasApiPort } from "@/application/ports/personas-api.port";
import type { Persona } from "@/domain/entities/persona";

export class GetPersonaUseCase {
  constructor(private readonly api: PersonasApiPort) {}

  execute(id: number): Promise<Persona> {
    return this.api.get(id);
  }
}
