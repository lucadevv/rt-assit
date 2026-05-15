/**
 * ShareApiPort — application contract for B7 share-link endpoints.
 *
 * Backend reference: python_backend/app/presentation/api/share_router.py
 *
 *   POST   /api/sessions/{id}/share        — create (Pro+ tier-gated)
 *   GET    /api/sessions/{id}/share        — list (owner)
 *   DELETE /api/share/{link_id}            — revoke (owner)
 *
 * The PUBLIC viewer endpoint (GET /api/public/share/:link_id) is NOT
 * exposed via this port — it's consumed by a future /shared/:id route
 * with no auth, which lives outside the authenticated app shell.
 */

import type {
  ShareLink,
  SharePermissions,
} from "@/domain/entities/share-link";

export interface CreateShareLinkRequest {
  sessionId: string;
  permissions: SharePermissions;
  /** Null = never expires. */
  expiresInHours: number | null;
}

export interface ShareApiPort {
  /** Authenticated — create a new share link. */
  createForSession(req: CreateShareLinkRequest): Promise<ShareLink>;

  /** Authenticated — list links for a session (includes revoked). */
  listForSession(sessionId: string): Promise<ShareLink[]>;

  /** Authenticated — revoke a link (idempotent; 404 if not owned). */
  revoke(linkId: string): Promise<boolean>;
}
