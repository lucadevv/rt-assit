/**
 * BetaInvitation — TypeScript mirror of the backend `BetaInvitation`
 * entity (python_backend/app/domain/entities/beta_invitation.py).
 *
 * Used by the founder-only /app/admin/invitations route.
 */

export interface BetaInvitation {
  id: string;
  email: string;
  invitedAt: string;
  /** True iff Resend confirmed delivery at invite time. */
  emailSent: boolean;
  /** True iff the invited user has authenticated at least once. */
  hasLoggedIn: boolean;
  /** ISO 8601 — last successful login (refresh-token mint), if any. */
  lastLoginAt: string | null;
  invitedByUserId: string | null;
}
