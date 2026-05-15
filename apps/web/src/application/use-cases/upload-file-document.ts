/**
 * UploadFileDocumentUseCase — multipart file upload (FR-32).
 *
 * Accepted extensions (mirrored from backend): .pdf .docx .md .markdown .txt
 * Backend enforces the 10MB hard cap; the UI also pre-validates to surface
 * errors quickly.
 */

import type {
  DocumentsApiPort,
  UploadFileRequest,
} from "@/application/ports/documents-api.port";
import type { DocumentListItem } from "@/domain/entities/document";

export class UploadFileDocumentUseCase {
  constructor(private readonly api: DocumentsApiPort) {}

  execute(req: UploadFileRequest): Promise<DocumentListItem> {
    return this.api.uploadFile(req);
  }
}
