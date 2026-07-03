/**
 * AdminInvitationsApiAdapter — concrete `AdminInvitationsApiPort` backed
 * by `ApiClient`.
 *
 * Backend reference (python_backend/app/presentation/api/admin_router.py):
 *   POST /api/admin/invitations  → InviteBetaUserResponse
 *   GET  /api/admin/invitations  → InvitationSummary[]
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping for request + response.
 *  - 403 surfaces as a regular ApiClient error — the page-level guard
 *    already prevents non-admin users from hitting these endpoints, so
 *    a 403 here is a server-state mismatch worth surfacing verbatim.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  AdminInvitationsApiPort,
  InviteBetaUserInput,
  InviteBetaUserResult,
} from "@/application/ports/admin-invitations-api.port";
import type { BetaInvitation } from "@/domain/entities/beta-invitation";

interface InviteBetaUserResponseRaw {
  invitation_id: string;
  user_id: string;
  email: string;
  email_sent: boolean;
}

interface InvitationSummaryRaw {
  id: string;
  email: string;
  invited_at: string;
  email_sent: boolean;
  has_logged_in: boolean;
  last_login_at: string | null;
  invited_by_user_id: string | null;
}

function mapInvitation(raw: InvitationSummaryRaw): BetaInvitation {
  return {
    id: raw.id,
    email: raw.email,
    invitedAt: raw.invited_at,
    emailSent: raw.email_sent,
    hasLoggedIn: raw.has_logged_in,
    lastLoginAt: raw.last_login_at,
    invitedByUserId: raw.invited_by_user_id,
  };
}

export class AdminInvitationsApiAdapter implements AdminInvitationsApiPort {
  constructor(private readonly api: ApiClient) {}

  async invite(input: InviteBetaUserInput): Promise<InviteBetaUserResult> {
    const body: { email: string; is_admin: boolean } = {
      email: input.email,
      is_admin: input.isAdmin ?? false,
    };
    const raw = await this.api.post<InviteBetaUserResponseRaw>(
      "/api/admin/invitations",
      body,
    );
    return {
      invitationId: raw.invitation_id,
      userId: raw.user_id,
      email: raw.email,
      emailSent: raw.email_sent,
    };
  }

  async list(): Promise<BetaInvitation[]> {
    const raw = await this.api.get<InvitationSummaryRaw[]>(
      "/api/admin/invitations",
    );
    return raw.map(mapInvitation);
  }
}

export const __testing = { mapInvitation };
