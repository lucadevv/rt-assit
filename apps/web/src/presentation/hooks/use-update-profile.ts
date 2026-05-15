"use client";

/**
 * useUpdateProfile — mutate name + language_preferred via PATCH /api/me.
 *
 * On success we update the auth store with the refreshed User so every
 * consumer (TopBar avatar, Sidebar name, dashboard greeting) re-renders
 * automatically. Errors are mapped to a Spanish message; the original
 * error is logged to the dev console for debugging.
 */

import { useCallback, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";
import type { UpdateUserProfileRequest } from "@/application/ports/users-api.port";
import type { User } from "@/domain/entities/user";

interface UseUpdateProfileResult {
  saving: boolean;
  error: string | null;
  update: (req: UpdateUserProfileRequest) => Promise<User | null>;
}

export function useUpdateProfile(): UseUpdateProfileResult {
  const { updateUserProfile } = useContainer();
  const setUser = useAuthStore((s) => s.setUser);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = useCallback(
    async (req: UpdateUserProfileRequest): Promise<User | null> => {
      setSaving(true);
      setError(null);
      try {
        const fresh = await updateUserProfile.execute(req);
        setUser(fresh);
        return fresh;
      } catch (err) {
        const msg =
          err instanceof Error
            ? err.message
            : "No pudimos actualizar tu perfil.";
        // eslint-disable-next-line no-console -- surfaced for dev debugging
        console.error("[susurra] PATCH /api/me failed:", err);
        setError(msg);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [updateUserProfile, setUser],
  );

  return { saving, error, update };
}
