/**
 * HasCvUploadedUseCase — convenience predicate used by the TopBar
 * indicator (CV ✅/❌).
 *
 * Implementation detail: we filter via `docType: 'cv'` so the backend
 * does the index lookup; we only need to know whether the list is
 * non-empty.
 */

import type { DocumentsApiPort } from "@/application/ports/documents-api.port";

export class HasCvUploadedUseCase {
  constructor(private readonly api: DocumentsApiPort) {}

  async execute(): Promise<boolean> {
    const list = await this.api.list({ docType: "cv" });
    return list.length > 0;
  }
}
