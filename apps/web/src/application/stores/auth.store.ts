/**
 * Auth store (Zustand) — caches the current `User` after the auth flow
 * resolves, so any component can read it synchronously without re-firing
 * `GetCurrentUserUseCase`.
 *
 * The store holds DOMAIN data (User) only. No tokens, no Clerk objects —
 * those stay in the auth adapter. This keeps the store framework-agnostic
 * and the layer boundary intact.
 */

import { create } from "zustand";
import type { User } from "@/domain/entities/user";

interface AuthStoreState {
  user: User | null;
  loading: boolean;
  /**
   * Timestamp (ms since epoch) of the last successful /api/me fetch.
   * Survives component remount (StrictMode, HMR) because Zustand state
   * is module-singleton. Used by useCurrentUser to dedup fetches within
   * a stale window. `null` means never fetched OR explicitly invalidated
   * (on logout, reset() sets it back to null).
   */
  lastFetchedMeAt: number | null;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  setLastFetchedMeAt: (timestamp: number | null) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  loading: true,
  lastFetchedMeAt: null,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  setLastFetchedMeAt: (lastFetchedMeAt) => set({ lastFetchedMeAt }),
  reset: () => set({ user: null, loading: false, lastFetchedMeAt: null }),
}));
