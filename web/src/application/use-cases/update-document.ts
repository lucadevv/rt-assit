/**
 * UpdateDocumentUseCase — patch title and/or content (FR-37).
 *
 * NOTE: backend may not implement PATCH /api/documents/{id} yet; in that
 * case the adapter surfaces a 405 error and the UI shows a "próximamente"
 * fallback. Use case stays in place so the wiring is ready when backend
 * adds the route.
 */

import type {
  DocumentsApiPort,
  UpdateDocumentRequest,
} from "@/application/ports/documents-api.port";
import type { Document } from "@/domain/entities/document";

export class UpdateDocumentUseCase {
  constructor(private readonly api: DocumentsApiPort) {}

  execute(id: number, req: UpdateDocumentRequest): Promise<Document> {
    return this.api.update(id, req);
  }
}
