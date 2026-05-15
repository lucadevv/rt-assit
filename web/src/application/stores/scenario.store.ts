/**
 * Scenario store (Zustand) — owns the available list + the user's current
 * pick. The current scenario id is persisted in localStorage under
 * `susurra-scenario` so the TopBar selector stays sticky across page loads.
 *
 * SSR caveat: localStorage access is guarded — Next.js SSR renders without
 * persistence touch, the F1 hook hydrates on mount.
 */

import { create } from "zustand";
import type { Scenario, ScenarioId } from "@/domain/entities/scenario";

const STORAGE_KEY = "susurra-scenario";

interface ScenarioStoreState {
  available: Scenario[];
  current: ScenarioId | null;
  setAvailable: (scenarios: Scenario[]) => void;
  setCurrent: (id: ScenarioId) => void;
}

export const useScenarioStore = create<ScenarioStoreState>((set) => ({
  available: [],
  current: null,
  setAvailable: (scenarios) => set({ available: scenarios }),
  setCurrent: (id) => {
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(STORAGE_KEY, id);
      } catch {
        // localStorage may be unavailable (private mode, quota); fall back to
        // in-memory only — selection still works for the current session.
      }
    }
    set({ current: id });
  },
}));

export const SCENARIO_STORAGE_KEY = STORAGE_KEY;
