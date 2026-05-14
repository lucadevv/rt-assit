/**
 * ListSessionShareLinksUseCase — wraps `ShareApiPort.listForSession`.
 *
 * Returns all links (active + revoked) so the owner can audit usage.
 * UI should sort active first, revoked last by `createdAt` desc.
 */

import type { ShareApiPort } from "@/application/ports/share-api.port";
import type { ShareLink } from "@/domain/entities/share-link";

export class ListSessionShareLinksUseCase {
  constructor(private readonly api: ShareApiPort) {}

  execute(sessionId: string): Promise<ShareLink[]> {
    return this.api.listForSession(sessionId);
  }
}
