/**
 * CreatePersonaUseCase — create a new persona row.
 */

import type {
  CreatePersonaInput,
  PersonasApiPort,
} from "@/application/ports/personas-api.port";
import type { Persona } from "@/domain/entities/persona";

export class CreatePersonaUseCase {
  constructor(private readonly api: PersonasApiPort) {}

  execute(input: CreatePersonaInput): Promise<Persona> {
    return this.api.create(input);
  }
}
