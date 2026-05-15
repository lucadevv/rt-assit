/**
 * GetDocumentUseCase — fetch a single document with full content (FR-36).
 *
 * Returns the domain `Document` shape (camelCase). 404s surface as Error
 * from the adapter; the caller decides UI treatment.
 */

import type { DocumentsApiPort } from "@/application/ports/documents-api.port";
import type { Document } from "@/domain/entities/document";

export class GetDocumentUseCase {
  constructor(private readonly api: DocumentsApiPort) {}

  execute(id: number): Promise<Document> {
    return this.api.get(id);
  }
}
