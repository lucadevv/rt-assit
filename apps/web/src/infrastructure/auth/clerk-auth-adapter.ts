"use client";

/**
 * ClerkAuthAdapter — implements `AuthPort` using `@clerk/nextjs`.
 *
 * Used only when `NEXT_PUBLIC_AUTH_MODE=clerk` (production-ish). For local
 * dev `NEXT_PUBLIC_AUTH_MODE=dev` we use `dev-auth-adapter` so contributors
 * don't need Clerk credentials to run the app.
 *
 * The adapter returns a SHALLOW user (id, email, name, avatar) sourced from
 * the Clerk session. The full domain `User` (with tier, language pref,
 * timestamps) comes from the backend via `GetCurrentUserUseCase`. Tier
 * defaults to `free` here as a placeholder — the hook overrides it after
 * fetching `/api/me`.
 */

import { useMemo } from "react";
import { useAuth as useClerkAuth, useUser as useClerkUser } from "@clerk/nextjs";
import type { AuthPort, AuthState } from "@/application/ports/auth.port";
import type { User } from "@/domain/entities/user";

export const AUTH_MODE: "dev" | "clerk" =
  (process.env.NEXT_PUBLIC_AUTH_MODE as "dev" | "clerk" | undefined) ?? "dev";

export function useClerkAuthAdapter(): AuthPort {
  const { isLoaded, isSignedIn, signOut, getToken } = useClerkAuth();
  const { user: clerkUser } = useClerkUser();

  // Memoised per-identity. Critical for referential stability — the container
  // re-instantiates use cases when auth changes; without useMemo every render
  // produces a new AuthPort object and the container's useMemo([auth]) loops
  // infinitely.
  const userId = clerkUser?.id ?? null;
  const email = clerkUser?.primaryEmailAddress?.emailAddress ?? null;
  const name = clerkUser?.fullName ?? null;
  const avatar = clerkUser?.imageUrl ?? null;
  const createdAtIso =
    clerkUser?.createdAt instanceof Date
      ? clerkUser.createdAt.toISOString()
      : null;

  return useMemo<AuthPort>(() => {
    return {
      getState(): AuthState {
        if (!isLoaded) {
          return { status: "loading" };
        }
        if (!isSignedIn || !userId) {
          return { status: "unauthenticated" };
        }

        const nowIso = new Date().toISOString();
        const user: User = {
          id: userId,
          email: email ?? "",
          name: name,
          avatarUrl: avatar,
          tier: "free",
          languagePreferred: "es-419",
          createdAt: createdAtIso ?? nowIso,
          updatedAt: nowIso,
        };

        return {
          status: "authenticated",
          user,
          getToken: async () => getToken(),
        };
      },
      async signOut() {
        await signOut();
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, userId, email, name, avatar, createdAtIso]);
}
