/**
 * UpdatePersonaUseCase — patch an existing persona.
 */

import type {
  PersonasApiPort,
  UpdatePersonaInput,
} from "@/application/ports/personas-api.port";
import type { Persona } from "@/domain/entities/persona";

export class UpdatePersonaUseCase {
  constructor(private readonly api: PersonasApiPort) {}

  execute(id: number, input: UpdatePersonaInput): Promise<Persona> {
    return this.api.update(id, input);
  }
}
