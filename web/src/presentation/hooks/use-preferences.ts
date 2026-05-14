"use client";

/**
 * usePreferences — fetch + mutate the user's preferences from anywhere in
 * the Settings UI.
 *
 * Lifecycle:
 *   - Mount → call GetPreferencesUseCase, hold result in component state.
 *   - update(req) → call UpdatePreferencesUseCase, replace state with the
 *     server's authoritative response (so timestamps update, validation
 *     errors surface immediately, and the cache stays in sync).
 *
 * Errors are mapped to a Spanish message for the UI; the original Error
 * is logged to the dev console for debugging. Saving state is exposed so
 * the page can render a "Guardando…" pill while the PATCH is in flight.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type {
  UpdateUserPreferences,
  UserPreferences,
} from "@/domain/entities/user-preferences";

interface UsePreferencesResult {
  prefs: UserPreferences | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
  update: (req: UpdateUserPreferences) => Promise<UserPreferences | null>;
  refresh: () => Promise<void>;
}

export function usePreferences(): UsePreferencesResult {
  const { getPreferences, updatePreferences } = useContainer();
  const [prefs, setPrefs] = useState<UserPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await getPreferences.execute();
      setPrefs(fresh);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos cargar tus preferencias.";
      // eslint-disable-next-line no-console -- surfaced for dev debugging
      console.error("[auri] failed to load /api/preferences:", err);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [getPreferences]);

  // StrictMode dedup: only run the initial fetch once per real mount.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;
    void refresh();
  }, [refresh]);

  const update = useCallback(
    async (req: UpdateUserPreferences): Promise<UserPreferences | null> => {
      setSaving(true);
      setError(null);
      try {
        const updated = await updatePreferences.execute(req);
        setPrefs(updated);
        return updated;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "No pudimos guardar el cambio.";
        // eslint-disable-next-line no-console -- surfaced for dev debugging
        console.error("[auri] failed to PATCH /api/preferences:", err);
        setError(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [updatePreferences],
  );

  return { prefs, loading, saving, error, update, refresh };
}
