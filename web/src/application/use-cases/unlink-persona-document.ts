/**
 * UnlinkPersonaDocumentUseCase — detach a Document from a Persona.
 */

import type { PersonasApiPort } from "@/application/ports/personas-api.port";

export class UnlinkPersonaDocumentUseCase {
  constructor(private readonly api: PersonasApiPort) {}

  execute(personaId: number, documentId: number): Promise<void> {
    return this.api.unlinkDocument(personaId, documentId);
  }
}
