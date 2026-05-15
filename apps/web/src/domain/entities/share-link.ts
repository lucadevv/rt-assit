/**
 * ShareLink domain entity — backend `ShareLinkResponse` mirror (B7).
 *
 * Premium tier feature (Pro: capped 10/period, Premium: unlimited).
 * The `id` (12-char short id) IS the access credential — anyone with the
 * link reaches the public viewer at `publicUrl`.
 *
 * Soft-delete model:
 *   - Active link    → revokedAt = null AND (expiresAt = null OR future)
 *   - Revoked link   → revokedAt set (returns 410 Gone publicly)
 *   - Expired link   → expiresAt in the past (returns 410 Gone publicly)
 *
 * Times are ISO 8601 UTC strings to keep the domain layer free of Date
 * timezone gotchas; presentation parses at render time.
 */

export type SharePermissions = "transcript_only" | "with_audio" | "edit";

export interface ShareLink {
  id: string;
  sessionId: string;
  permissions: SharePermissions;
  /** Null = never expires. */
  expiresAt: string | null;
  /** Null = active. Non-null = revoked at this timestamp. */
  revokedAt: string | null;
  viewCount: number;
  createdAt: string;
  /** Computed by backend from SHARE_PUBLIC_BASE_URL env var. */
  publicUrl: string;
}

/**
 * Pure domain helper — UI uses this to decide whether to show a "Activo"
 * pill or a revoked/expired callout. Mirrors `ShareLink.is_active` on the
 * backend.
 */
export function isShareLinkActive(
  link: ShareLink,
  nowIso: string = new Date().toISOString(),
): boolean {
  if (link.revokedAt !== null) return false;
  if (link.expiresAt === null) return true;
  return link.expiresAt > nowIso;
}
