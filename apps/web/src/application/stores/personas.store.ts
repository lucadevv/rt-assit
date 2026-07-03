/**
 * Personas store (Zustand 5) — owns the user's personas list.
 *
 * Why a store (instead of per-page state):
 *  - Both the `/app/personas` page and the NewSessionModal need the list.
 *    A single shared source avoids two parallel fetches.
 *  - Optimistic upsert/remove keeps the UI snappy.
 *
 * No infrastructure imports here — domain types only (Clean Arch mandate).
 */

import { create } from "zustand";
import type { Persona } from "@/domain/entities/persona";

interface PersonasStoreState {
  personas: Persona[];
  loading: boolean;
  error: string | null;
  /**
   * True after the first successful list() fetch — prevents flashing the
   * empty state during initial load. Mirrors `useDocuments` pattern.
   */
  hasFetched: boolean;
  /** Dedup window — survives HMR via store-singleton state. */
  lastFetchedAt: number | null;

  setPersonas: (list: Persona[]) => void;
  upsertPersona: (p: Persona) => void;
  removePersona: (id: number) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setHasFetched: (v: boolean) => void;
  setLastFetchedAt: (timestamp: number | null) => void;
  /** Reset the default flag on every other persona — used when one is set. */
  markDefault: (id: number) => void;
  reset: () => void;
}

export const usePersonasStore = create<PersonasStoreState>((set) => ({
  personas: [],
  loading: false,
  error: null,
  hasFetched: false,
  lastFetchedAt: null,

  setPersonas: (list) => set({ personas: list }),

  upsertPersona: (p) =>
    set((state) => {
      const idx = state.personas.findIndex((x) => x.id === p.id);
      if (idx === -1) {
        return { personas: [p, ...state.personas] };
      }
      const next = state.personas.slice();
      next[idx] = p;
      return { personas: next };
    }),

  removePersona: (id) =>
    set((state) => ({
      personas: state.personas.filter((p) => p.id !== id),
    })),

  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setHasFetched: (v) => set({ hasFetched: v }),
  setLastFetchedAt: (lastFetchedAt) => set({ lastFetchedAt }),

  markDefault: (id) =>
    set((state) => ({
      personas: state.personas.map((p) => ({
        ...p,
        isDefault: p.id === id,
      })),
    })),

  reset: () =>
    set({
      personas: [],
      loading: false,
      error: null,
      hasFetched: false,
      lastFetchedAt: null,
    }),
}));

/** Pure selector: return the default persona (or null if none). */
export function selectDefaultPersona(state: {
  personas: Persona[];
}): Persona | null {
  return state.personas.find((p) => p.isDefault) ?? null;
}
