"use client";

/**
 * useRenameSpeaker — wraps RenameSpeakerUseCase with optimistic store
 * updates.
 *
 * Flow:
 *   1. Caller invokes `rename(deepgramId, label)`.
 *   2. We optimistically update the local speaker map (label changes
 *      immediately in the UI).
 *   3. Fire POST to backend.
 *   4. On success → upsert with the canonical Speaker (no-op if same).
 *   5. On failure → rollback to the previous label and surface the error.
 *
 * Note: the backend ALSO broadcasts `speaker_label_updated` over WS, so
 * after the request lands we may receive a duplicate update — the store's
 * `upsertSpeaker` is idempotent so this is harmless.
 */

import { useCallback } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useSessionStore } from "@/application/stores/session.store";

interface UseRenameSpeakerResult {
  rename: (deepgramSpeakerId: number, label: string | null) => Promise<void>;
}

export function useRenameSpeaker(): UseRenameSpeakerResult {
  const { renameSpeaker, analytics } = useContainer();

  const rename = useCallback(
    async (deepgramSpeakerId: number, label: string | null): Promise<void> => {
      const state = useSessionStore.getState();
      const session = state.session;
      if (!session) return;

      const prev = state.speakers.get(deepgramSpeakerId);
      if (prev) {
        state.upsertSpeaker({ ...prev, label });
      }
      try {
        const updated = await renameSpeaker.execute(
          session.id,
          deepgramSpeakerId,
          label,
        );
        state.upsertSpeaker(updated);
        analytics.track({ name: "speaker_renamed" });
      } catch (err: unknown) {
        if (prev) {
          state.upsertSpeaker(prev);
        }
        // eslint-disable-next-line no-console
        console.error("[auri/live] rename speaker failed", err);
      }
    },
    [renameSpeaker, analytics],
  );

  return { rename };
}
