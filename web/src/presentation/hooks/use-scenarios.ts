"use client";

/**
 * useScenarios — fetches the scenario catalog once and exposes
 * `{ available, current, setCurrent }` to consumers.
 *
 * The current scenario is restored from localStorage on first hydration —
 * if the stored value matches an available scenario we use it; otherwise
 * we default to the first available scenario (preserving user-friendly
 * behavior for unknown stored ids after a backend update).
 */

import { useEffect, useRef } from "react";
import { useContainer } from "@/infrastructure/di/container";
import {
  SCENARIO_STORAGE_KEY,
  useScenarioStore,
} from "@/application/stores/scenario.store";
import type { Scenario, ScenarioId } from "@/domain/entities/scenario";

interface UseScenariosResult {
  available: Scenario[];
  current: ScenarioId | null;
  setCurrent: (id: ScenarioId) => void;
}

export function useScenarios(): UseScenariosResult {
  const { listScenarios } = useContainer();
  const available = useScenarioStore((s) => s.available);
  const current = useScenarioStore((s) => s.current);
  const setAvailable = useScenarioStore((s) => s.setAvailable);
  const setCurrent = useScenarioStore((s) => s.setCurrent);

  // StrictMode dedup: even with `available.length > 0` short-circuit,
  // both mounts in dev can see length=0 simultaneously and double-fire
  // the fetch before the store updates. The ref guarantees a single fire.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    if (available.length > 0) {
      return;
    }
    fetchedRef.current = true;
    listScenarios
      .execute()
      .then((scenarios) => {
        setAvailable(scenarios);
        if (scenarios.length === 0) {
          return;
        }
        const stored =
          typeof window === "undefined"
            ? null
            : window.localStorage.getItem(SCENARIO_STORAGE_KEY);
        const validStored = stored
          ? scenarios.find((s) => s.id === stored)
          : undefined;
        const first = scenarios[0];
        if (current) {
          return;
        }
        if (validStored) {
          setCurrent(validStored.id);
        } else if (first) {
          setCurrent(first.id);
        }
      })
      .catch((err: unknown) => {
        // eslint-disable-next-line no-console
        console.error("[auri] failed to fetch /api/scenarios:", err);
      });
  }, [available.length, current, listScenarios, setAvailable, setCurrent]);

  return { available, current, setCurrent };
}
