"use client";

/**
 * Auth factory — picks the right adapter at runtime based on
 * `NEXT_PUBLIC_AUTH_MODE`.
 *
 * Why a runtime hook (not a build-time const):
 *   - Both adapters call React hooks (`useClerkAuth`, etc.). React's rules
 *     of hooks require a stable call sequence per render — the AUTH_MODE
 *     env var is a build-time literal (Next inlines `process.env.NEXT_PUBLIC_*`
 *     during build), so the branch picked here is stable across renders.
 *   - We do NOT mount Clerk's hooks in dev mode, so the dev developer never
 *     needs Clerk credentials to run the app.
 */

import type { AuthPort } from "@/application/ports/auth.port";
import { AUTH_MODE, useClerkAuthAdapter } from "./clerk-auth-adapter";
import { useCustomAuthAdapter } from "./custom-auth-adapter";
import { useDevAuthAdapter } from "./dev-auth-adapter";

export function useAuthAdapter(): AuthPort {
  if (AUTH_MODE === "clerk") {
    // eslint-disable-next-line react-hooks/rules-of-hooks -- AUTH_MODE is a
    // build-time literal (Next inlines NEXT_PUBLIC_*); the branch is
    // permanent for any given build, so hook order is stable per render.
    return useClerkAuthAdapter();
  }
  if (AUTH_MODE === "custom") {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    return useCustomAuthAdapter();
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useDevAuthAdapter();
}

export { AUTH_MODE };
