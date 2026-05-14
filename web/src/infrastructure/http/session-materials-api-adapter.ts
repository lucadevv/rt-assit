/**
 * SessionMaterialsApiAdapter — `SessionMaterialsApiPort` impl backed by `ApiClient`.
 *
 * Backend reference (Phase H1):
 *   GET    /api/sessions/{session_id}/materials
 *   POST   /api/sessions/{session_id}/materials
 *   DELETE /api/sessions/{session_id}/materials/{material_id}
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping.
 *  - URL encoding of the (UUID-shaped) session_id.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  CreateSessionMaterialInput,
  SessionMaterialsApiPort,
} from "@/application/ports/session-materials-api.port";
import type {
  SessionMaterial,
  SessionMaterialType,
} from "@/domain/entities/session-material";
import { normaliseSessionMaterialType } from "@/domain/entities/session-material";

interface SessionMaterialResponseRaw {
  id: number;
  session_id: string;
  material_type: string;
  title: string | null;
  content: string | null;
  source_url: string | null;
  created_at: string;
}

function mapMaterial(raw: SessionMaterialResponseRaw): SessionMaterial {
  const materialType: SessionMaterialType = normaliseSessionMaterialType(
    raw.material_type,
  );
  return {
    id: raw.id,
    sessionId: raw.session_id,
    materialType,
    title: raw.title,
    content: raw.content,
    sourceUrl: raw.source_url,
    createdAt: raw.created_at,
  };
}

function toCreateBody(
  input: CreateSessionMaterialInput,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    material_type: input.materialType,
  };
  if (input.title !== undefined) body["title"] = input.title;
  if (input.content !== undefined) body["content"] = input.content;
  if (input.sourceUrl !== undefined) body["source_url"] = input.sourceUrl;
  return body;
}

export class SessionMaterialsApiAdapter implements SessionMaterialsApiPort {
  constructor(private readonly api: ApiClient) {}

  async list(sessionId: string): Promise<SessionMaterial[]> {
    const raw = await this.api.get<SessionMaterialResponseRaw[]>(
      `/api/sessions/${encodeURIComponent(sessionId)}/materials`,
    );
    return raw.map(mapMaterial);
  }

  async create(
    sessionId: string,
    input: CreateSessionMaterialInput,
  ): Promise<SessionMaterial> {
    const raw = await this.api.post<SessionMaterialResponseRaw>(
      `/api/sessions/${encodeURIComponent(sessionId)}/materials`,
      toCreateBody(input),
    );
    return mapMaterial(raw);
  }

  async delete(sessionId: string, materialId: number): Promise<void> {
    await this.api.delete<{ deleted: boolean }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/materials/${materialId}`,
    );
  }
}

export const __testing = { mapMaterial, toCreateBody };
