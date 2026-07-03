/**
 * InviteBetaUserUseCase — POST /api/admin/invitations.
 *
 * Founder-only. Provisions a new beta user and asks the backend to
 * send them a welcome email with their generated credentials.
 */

import type {
  AdminInvitationsApiPort,
  InviteBetaUserResult,
} from "@/application/ports/admin-invitations-api.port";

export class InviteBetaUserUseCase {
  constructor(private readonly api: AdminInvitationsApiPort) {}

  execute(email: string): Promise<InviteBetaUserResult> {
    return this.api.invite({ email });
  }
}
