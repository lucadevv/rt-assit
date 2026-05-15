/**
 * ShareApiAdapter — concrete `ShareApiPort` impl.
 *
 * Backend reference: python_backend/app/presentation/api/share_router.py
 *
 * Note: the ShareLink payload uses snake_case from the backend; we map
 * permissions defensively into the SharePermissions union so unknown
 * values fall back to "transcript_only" (the safest default — viewers
 * see less, never more, than they should).
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  CreateShareLinkRequest,
  ShareApiPort,
} from "@/application/ports/share-api.port";
import type {
  ShareLink,
  SharePermissions,
} from "@/domain/entities/share-link";

interface ShareLinkRaw {
  id: string;
  session_id: string;
  permissions: string;
  expires_at: string | null;
  revoked_at: string | null;
  view_count: number;
  created_at: string;
  public_url: string;
}

const KNOWN_PERMISSIONS: readonly SharePermissions[] = [
  "transcript_only",
  "with_audio",
  "edit",
];

function asPermissions(raw: string): SharePermissions {
  return (KNOWN_PERMISSIONS as readonly string[]).includes(raw)
    ? (raw as SharePermissions)
    : "transcript_only";
}

function mapShareLink(raw: ShareLinkRaw): ShareLink {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    permissions: asPermissions(raw.permissions),
    expiresAt: raw.expires_at,
    revokedAt: raw.revoked_at,
    viewCount: raw.view_count,
    createdAt: raw.created_at,
    publicUrl: raw.public_url,
  };
}

export class ShareApiAdapter implements ShareApiPort {
  constructor(private readonly api: ApiClient) {}

  async createForSession(req: CreateShareLinkRequest): Promise<ShareLink> {
    const body: Record<string, unknown> = {
      permissions: req.permissions,
      expires_in_hours: req.expiresInHours,
    };
    const raw = await this.api.post<ShareLinkRaw>(
      `/api/sessions/${encodeURIComponent(req.sessionId)}/share`,
      body,
    );
    return mapShareLink(raw);
  }

  async listForSession(sessionId: string): Promise<ShareLink[]> {
    const raw = await this.api.get<ShareLinkRaw[]>(
      `/api/sessions/${encodeURIComponent(sessionId)}/share`,
    );
    return raw.map(mapShareLink);
  }

  async revoke(linkId: string): Promise<boolean> {
    const raw = await this.api.delete<{ revoked: boolean }>(
      `/api/share/${encodeURIComponent(linkId)}`,
    );
    return raw.revoked === true;
  }
}
