/**
 * RevokeShareLinkUseCase — soft-delete a share link.
 *
 * Idempotent at the backend (re-revoking returns 404). UI flips the link
 * row to "Revocada" optimistically and falls back to a refetch on error.
 */

import type { ShareApiPort } from "@/application/ports/share-api.port";

export class RevokeShareLinkUseCase {
  constructor(private readonly api: ShareApiPort) {}

  execute(linkId: string): Promise<boolean> {
    return this.api.revoke(linkId);
  }
}
