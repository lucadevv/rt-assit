/**
 * ListDocumentsUseCase — fetch the user's KB documents (FR-31).
 *
 * Thin wrapper over `DocumentsApiPort.list` so the application layer
 * exposes a uniform "use case" surface for hooks/components to consume
 * via the composition root.
 */

import type {
  DocumentListFilters,
  DocumentsApiPort,
} from "@/application/ports/documents-api.port";
import type { DocumentListItem } from "@/domain/entities/document";

export class ListDocumentsUseCase {
  constructor(private readonly api: DocumentsApiPort) {}

  execute(filters?: DocumentListFilters): Promise<DocumentListItem[]> {
    return this.api.list(filters);
  }
}
