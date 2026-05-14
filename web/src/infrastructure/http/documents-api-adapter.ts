/**
 * DocumentsApiAdapter — concrete `DocumentsApiPort` implementation.
 *
 * Backend reference:
 *  - GET    /api/documents?scenario=&doc_type=
 *  - GET    /api/documents/{id}
 *  - POST   /api/documents          (multipart: file + doc_type + scenario)
 *  - POST   /api/documents/url      (JSON)
 *  - POST   /api/documents/text     (JSON)
 *  - PATCH  /api/documents/{id}     (JSON, may not exist yet — surfaces 405)
 *  - DELETE /api/documents/{id}
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping (application stays clean).
 *  - Multipart upload escape hatch (the JSON `ApiClient` cannot do
 *    `FormData` — we use raw `fetch` here and forward the bearer token
 *    via the same `getToken` callback).
 *  - Error normalisation: non-2xx responses throw `Error(message)` with
 *    the status code and body so callers can render a Spanish message.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  DocumentListFilters,
  DocumentsApiPort,
  UpdateDocumentRequest,
  UploadFileRequest,
  UploadTextRequest,
  UploadUrlRequest,
} from "@/application/ports/documents-api.port";
import type {
  Document,
  DocType,
  DocumentListItem,
} from "@/domain/entities/document";
import { normaliseDocType } from "@/domain/entities/document";

interface DocumentSummaryRaw {
  id: number;
  doc_type: string;
  scenario: string | null;
  title: string;
  source: string | null;
  uploaded_at: string;
  size_chars: number;
  metadata?: Record<string, unknown> | null;
  is_primary?: boolean | null;
}

interface DocumentDetailRaw {
  id: number;
  doc_type: string;
  scenario: string | null;
  title: string;
  content: string;
  source: string | null;
  uploaded_at: string;
  metadata?: Record<string, unknown> | null;
  is_primary?: boolean | null;
}

/** Backend POST /api/documents (and /url, /text) returns this shape. */
interface UploadFileResponseRaw {
  id: number;
  title: string;
  doc_type: string;
  scenario: string | null;
  size_chars: number;
}

function mapListItem(raw: DocumentSummaryRaw): DocumentListItem {
  return {
    id: raw.id,
    docType: normaliseDocType(raw.doc_type),
    scenario: raw.scenario,
    title: raw.title,
    source: raw.source,
    uploadedAt: raw.uploaded_at,
    sizeChars: raw.size_chars,
    metadata: raw.metadata ?? {},
    isPrimary: raw.is_primary === true,
  };
}

function mapDetail(raw: DocumentDetailRaw): Document {
  return {
    id: raw.id,
    // Backend single-tenant view does not echo user_id; the store does
    // not need it (multi-tenant scoping happens on the backend by JWT).
    userId: "",
    docType: normaliseDocType(raw.doc_type),
    scenario: raw.scenario,
    title: raw.title,
    content: raw.content,
    source: raw.source,
    metadata: raw.metadata ?? {},
    uploadedAt: raw.uploaded_at,
    sizeChars: raw.content?.length ?? 0,
    isPrimary: raw.is_primary === true,
  };
}

/**
 * Promote the backend's UploadFileResponse (no metadata/uploaded_at) to a
 * full DocumentListItem so the store can prepend it without an extra
 * round-trip. The missing fields are filled with reasonable defaults that
 * a follow-up `list()` will overwrite.
 */
function mapUploadResponse(
  raw: UploadFileResponseRaw,
  source: string | null,
): DocumentListItem {
  return {
    id: raw.id,
    docType: normaliseDocType(raw.doc_type),
    scenario: raw.scenario,
    title: raw.title,
    source,
    uploadedAt: new Date().toISOString(),
    sizeChars: raw.size_chars,
    metadata: {},
    isPrimary: false,
  };
}

export class DocumentsApiAdapter implements DocumentsApiPort {
  constructor(
    private readonly api: ApiClient,
    private readonly baseUrl: string,
    private readonly getToken?: () => Promise<string | null>,
  ) {}

  async list(filters?: DocumentListFilters): Promise<DocumentListItem[]> {
    const params = new URLSearchParams();
    if (
      filters?.scenario !== undefined &&
      filters.scenario !== null &&
      filters.scenario !== ""
    ) {
      params.set("scenario", filters.scenario);
    }
    if (filters?.docType) {
      params.set("doc_type", filters.docType);
    }
    const qs = params.toString();
    const path = qs ? `/api/documents?${qs}` : "/api/documents";
    const raw = await this.api.get<DocumentSummaryRaw[]>(path);
    return raw.map(mapListItem);
  }

  async get(id: number): Promise<Document> {
    const raw = await this.api.get<DocumentDetailRaw>(`/api/documents/${id}`);
    return mapDetail(raw);
  }

  async uploadFile(req: UploadFileRequest): Promise<DocumentListItem> {
    // Multipart — bypass the JSON ApiClient. We still forward the bearer
    // token via `getToken` so multi-tenant auth holds.
    const fd = new FormData();
    fd.append("file", req.file);
    fd.append("doc_type", req.docType);
    if (req.scenario) {
      fd.append("scenario", req.scenario);
    }

    const headers: Record<string, string> = {};
    if (this.getToken) {
      try {
        const token = await this.getToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      } catch {
        // proceed without auth header — backend rejects with 401 if needed
      }
    }

    const res = await fetch(`${this.baseUrl}/api/documents`, {
      method: "POST",
      headers,
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`Upload falló (${res.status}): ${text || res.statusText}`);
    }
    const raw = (await res.json()) as UploadFileResponseRaw;
    return mapUploadResponse(raw, req.file.name);
  }

  async uploadUrl(req: UploadUrlRequest): Promise<DocumentListItem> {
    const raw = await this.api.post<UploadFileResponseRaw>(
      "/api/documents/url",
      {
        url: req.url,
        doc_type: req.docType,
        scenario: req.scenario,
      },
    );
    return mapUploadResponse(raw, req.url);
  }

  async uploadText(req: UploadTextRequest): Promise<DocumentListItem> {
    const raw = await this.api.post<UploadFileResponseRaw>(
      "/api/documents/text",
      {
        title: req.title,
        text: req.text,
        doc_type: req.docType,
        scenario: req.scenario,
      },
    );
    return mapUploadResponse(raw, "pasted");
  }

  async update(id: number, req: UpdateDocumentRequest): Promise<Document> {
    const body: Record<string, unknown> = {};
    if (req.title !== undefined) body["title"] = req.title;
    if (req.content !== undefined) body["content"] = req.content;
    if (req.isPrimary !== undefined) body["is_primary"] = req.isPrimary;
    const raw = await this.api.patch<DocumentDetailRaw>(
      `/api/documents/${id}`,
      body,
    );
    return mapDetail(raw);
  }

  async delete(id: number): Promise<void> {
    await this.api.delete<{ deleted: boolean }>(`/api/documents/${id}`);
  }
}

export const __testing = { mapListItem, mapDetail, mapUploadResponse };
export type { DocType };
