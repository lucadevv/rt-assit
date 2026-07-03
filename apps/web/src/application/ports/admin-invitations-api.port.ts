/**
 * AdminInvitationsApiPort — REST surface for the founder-only invitations
 * workflow.
 *
 * Backend contract:
 *   POST /api/admin/invitations  — provision user + send welcome email
 *   GET  /api/admin/invitations  — list invitations (newest-first, 100 max)
 *
 * Both endpoints are gated server-side by `user.is_admin === true`.
 */

import type { BetaInvitation } from "@/domain/entities/beta-invitation";

export interface InviteBetaUserInput {
  email: string;
  isAdmin?: boolean;
}

export interface InviteBetaUserResult {
  invitationId: string;
  userId: string;
  email: string;
  /**
   * Whether Resend confirmed delivery synchronously. False means the
   * user was created but the welcome email failed — founder can re-send
   * manually from the UI.
   */
  emailSent: boolean;
}

export interface AdminInvitationsApiPort {
  invite(input: InviteBetaUserInput): Promise<InviteBetaUserResult>;
  list(): Promise<BetaInvitation[]>;
}
