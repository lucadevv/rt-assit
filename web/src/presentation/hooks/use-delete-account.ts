"use client";

/**
 * useDeleteAccount — GDPR delete (FR-110).
 *
 * Flow: DELETE /api/me → reset auth store → sign out → redirect /sign-in.
 * The presentation layer is expected to confirm with the user before
 * calling `confirmDelete()` (the Settings UI requires the user to type
 * their email exactly).
 */

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";

interface UseDeleteAccountResult {
  deleting: boolean;
  error: string | null;
  confirmDelete: () => Promise<boolean>;
}

export function useDeleteAccount(): UseDeleteAccountResult {
  const { deleteUserData, auth } = useContainer();
  const reset = useAuthStore((s) => s.reset);
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirmDelete = useCallback(async (): Promise<boolean> => {
    setDeleting(true);
    setError(null);
    try {
      await deleteUserData.execute();
      // Clear auth state and route to /sign-in. We do this AFTER the
      // successful DELETE so a network failure leaves the user logged in
      // with an actionable error instead of a half-broken state.
      try {
        await auth.signOut();
      } catch {
        // signOut failing in dev mode is benign — the row is already gone.
      }
      reset();
      router.replace("/sign-in");
      return true;
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "No pudimos eliminar la cuenta.";
      // eslint-disable-next-line no-console -- surfaced for dev debugging
      console.error("[auri] DELETE /api/me failed:", err);
      setError(msg);
      return false;
    } finally {
      setDeleting(false);
    }
  }, [deleteUserData, auth, reset, router]);

  return { deleting, error, confirmDelete };
}
