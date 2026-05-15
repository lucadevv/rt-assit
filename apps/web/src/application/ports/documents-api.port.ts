/**
 * DocumentsApiPort — application contract for the Knowledge Base REST surface.
 *
 * Backend reference: `python_backend/app/presentation/api/documents_router.py`.
 *
 * Why a port:
 *  - Use cases consume this interface, not the concrete adapter, so they
 *    stay trivially mockable for unit tests (Clean Arch mandate).
 *  - The adapter handles snake_case ↔ camelCase mapping + multipart upload
 *    fallback (ApiClient is JSON-only).
 *
 * Scope semantics:
 *  - `scenario === null` → global doc (applies to every scenario).
 *  - `scenario !== null` → tied to a specific scenario id.
 *
 * NOTE: backend currently exposes POST/GET/DELETE for documents. PATCH
 * (`update`) is included in the port because the master plan calls for it
 * in F3 — the adapter targets `PATCH /api/documents/{id}` and will surface
 * a 405 to the UI when the backend does not implement it yet (the modal
 * shows a "próximamente" notice in that case).
 */

import type {
  Document,
  DocType,
  DocumentListItem,
} from "@/domain/entities/document";

export interface DocumentListFilters {
  scenario?: string | null;
  docType?: DocType;
}

export interface UploadFileRequest {
  file: File;
  docType: DocType;
  scenario: string | null;
}

export interface UploadUrlRequest {
  url: string;
  docType: DocType;
  scenario: string | null;
}

export interface UploadTextRequest {
  title: string;
  text: string;
  docType: DocType;
  scenario: string | null;
}

export interface UpdateDocumentRequest {
  title?: string;
  content?: string;
  /**
   * Mark this document as the primary identity doc for its scope (global
   * vs scenario-scoped). Backend should auto-unmark any previously-primary
   * doc in the same scope. Optional so existing callers aren't forced to
   * pass it.
   */
  isPrimary?: boolean;
}

export interface DocumentsApiPort {
  list(filters?: DocumentListFilters): Promise<DocumentListItem[]>;
  get(id: number): Promise<Document>;
  uploadFile(req: UploadFileRequest): Promise<DocumentListItem>;
  uploadUrl(req: UploadUrlRequest): Promise<DocumentListItem>;
  uploadText(req: UploadTextRequest): Promise<DocumentListItem>;
  update(id: number, req: UpdateDocumentRequest): Promise<Document>;
  delete(id: number): Promise<void>;
}
