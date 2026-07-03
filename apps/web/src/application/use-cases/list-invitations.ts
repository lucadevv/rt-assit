/**
 * ListInvitationsUseCase — GET /api/admin/invitations.
 *
 * Returns the founder's past invitations (newest-first, 100 max).
 */

import type { AdminInvitationsApiPort } from "@/application/ports/admin-invitations-api.port";
import type { BetaInvitation } from "@/domain/entities/beta-invitation";

export class ListInvitationsUseCase {
  constructor(private readonly api: AdminInvitationsApiPort) {}

  execute(): Promise<BetaInvitation[]> {
    return this.api.list();
  }
}
