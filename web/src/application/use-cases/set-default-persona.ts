/**
 * SetDefaultPersonaUseCase — mark a persona as the user's default.
 *
 * Backend ensures only one persona per user holds `is_default=true`;
 * any previously-default persona is auto-unmarked.
 */

import type { PersonasApiPort } from "@/application/ports/personas-api.port";
import type { Persona } from "@/domain/entities/persona";

export class SetDefaultPersonaUseCase {
  constructor(private readonly api: PersonasApiPort) {}

  execute(id: number): Promise<Persona> {
    return this.api.setDefault(id);
  }
}
