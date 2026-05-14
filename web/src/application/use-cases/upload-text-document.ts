/**
 * UploadTextDocumentUseCase — paste raw text as a document (FR-34).
 *
 * Useful for quick capture (e.g. job offer copy/paste from a portal that
 * blocks scraping).
 */

import type {
  DocumentsApiPort,
  UploadTextRequest,
} from "@/application/ports/documents-api.port";
import type { DocumentListItem } from "@/domain/entities/document";

export class UploadTextDocumentUseCase {
  constructor(private readonly api: DocumentsApiPort) {}

  execute(req: UploadTextRequest): Promise<DocumentListItem> {
    return this.api.uploadText(req);
  }
}
