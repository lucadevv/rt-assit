/**
 * DeleteDocumentUseCase — remove a document by id (FR-35).
 *
 * The presentation layer is expected to ask for confirmation before
 * invoking this — backend does NOT soft-delete docs (yet).
 */

import type { DocumentsApiPort } from "@/application/ports/documents-api.port";

export class DeleteDocumentUseCase {
  constructor(private readonly api: DocumentsApiPort) {}

  execute(id: number): Promise<void> {
    return this.api.delete(id);
  }
}
