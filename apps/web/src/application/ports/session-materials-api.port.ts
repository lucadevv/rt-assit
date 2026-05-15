/**
 * SessionMaterialsApiPort — REST contract for per-session materials.
 *
 * Backend reference (Phase H1, in parallel):
 *   GET    /api/sessions/{session_id}/materials
 *   POST   /api/sessions/{session_id}/materials
 *   DELETE /api/sessions/{session_id}/materials/{material_id}
 *
 * Materials are POSTed AFTER the session row is created (the NewSessionModal
 * keeps them in local state until POST /api/sessions succeeds, then fires
 * a POST per material against this port).
 */

import type {
  SessionMaterial,
  SessionMaterialType,
} from "@/domain/entities/session-material";

export interface CreateSessionMaterialInput {
  materialType: SessionMaterialType;
  title?: string | null;
  content?: string | null;
  sourceUrl?: string | null;
}

export interface SessionMaterialsApiPort {
  list(sessionId: string): Promise<SessionMaterial[]>;
  create(
    sessionId: string,
    input: CreateSessionMaterialInput,
  ): Promise<SessionMaterial>;
  delete(sessionId: string, materialId: number): Promise<void>;
}
