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
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  reset: () => void;
}

export const useAuthStore = create<AuthStoreState>((set) => ({
  user: null,
  loading: true,
  setUser: (user) => set({ user, loading: false }),
  setLoading: (loading) => set({ loading }),
  reset: () => set({ user: null, loading: false }),
}));
