/**
 * AuthPort — the application's contract for authentication.
 *
 * Adapters (infrastructure/auth/*) implement this port:
 *   - ClerkAuthAdapter: uses @clerk/nextjs (production)
 *   - DevAuthAdapter: synthesises `dev_default` user (local dev)
 *
 * The port is intentionally tiny — fetching the actual user record (with
 * tier, prefs, etc.) is a separate use case (`GetCurrentUserUseCase`) that
 * hits the backend's GET /api/me. The auth port only owns the IDENTITY
 * concern (who is logged in + how to get a fresh JWT).
 */

import type { User } from "@/domain/entities/user";

export type AuthState =
  | { status: "loading" }
  | {
      status: "authenticated";
      user: User;
      getToken: () => Promise<string | null>;
    }
  | { status: "unauthenticated" };

export interface AuthPort {
  getState(): AuthState;
  signOut(): Promise<void>;
}
