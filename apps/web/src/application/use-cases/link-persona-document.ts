/**
 * LinkPersonaDocumentUseCase — attach a Document to a Persona.
 *
 * `isIdentity=true`  → the doc represents the persona's identity (CV, profile).
 * `isIdentity=false` → the doc is supplementary knowledge.
 */

import type { PersonasApiPort } from "@/application/ports/personas-api.port";

export class LinkPersonaDocumentUseCase {
  constructor(private readonly api: PersonasApiPort) {}

  execute(
    personaId: number,
    documentId: number,
    isIdentity: boolean,
  ): Promise<void> {
    return this.api.linkDocument(personaId, documentId, isIdentity);
  }
}
