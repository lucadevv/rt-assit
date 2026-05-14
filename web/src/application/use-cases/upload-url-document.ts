/**
 * UploadUrlDocumentUseCase — ingest a remote document by URL (FR-33).
 *
 * The backend handles the actual fetch + extraction; this use case only
 * forwards the request via the port.
 */

import type {
  DocumentsApiPort,
  UploadUrlRequest,
} from "@/application/ports/documents-api.port";
import type { DocumentListItem } from "@/domain/entities/document";

export class UploadUrlDocumentUseCase {
  constructor(private readonly api: DocumentsApiPort) {}

  execute(req: UploadUrlRequest): Promise<DocumentListItem> {
    return this.api.uploadUrl(req);
  }
}
