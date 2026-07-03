"use client";

/**
 * useDocuments — main consumer of the KB list.
 *
 * Responsibilities:
 *  - Trigger the initial fetch on mount (only if the store hasn't been
 *    populated yet — both the TopBar indicator and the /knowledge page
 *    use this hook, so we share the same data without double-fetching).
 *  - Expose `refresh`, `remove`, `byType`, `hasCv` ergonomically.
 *
 * The store is the source of truth — no local state.
 */

import { useCallback, useEffect } from "react";
import { useContainer } from "@/infrastructure/di/container";
import { useAuthStore } from "@/application/stores/auth.store";
import {
  selectByType,
  selectHasCv,
  useDocumentsStore,
} from "@/application/stores/documents.store";
import type { DocType, DocumentListItem } from "@/domain/entities/document";

const DOCUMENTS_STALE_MS = 30_000;

interface UseDocumentsResult {
  documents: DocumentListItem[];
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
  hasCv: boolean;
  byType: Map<DocType, DocumentListItem[]>;
  refresh: () => Promise<void>;
  remove: (id: number) => Promise<void>;
  /**
   * Toggle the primary-identity flag of a document. Optimistically updates
   * the store: the target doc gets `isPrimary=true` and any other doc in the
   * same scope (global vs same-scenario) gets unmarked. Backend is
   * authoritative — if the call fails (e.g. backend hasn't shipped the
   * `is_primary` PATCH yet) we revert the optimistic update and surface
   * the error in `error`.
   */
  setPrimary: (id: number, value: boolean) => Promise<void>;
}

export function useDocuments(): UseDocumentsResult {
  const { listDocuments, deleteDocument, updateDocument } = useContainer();
  const documents = useDocumentsStore((s) => s.documents);
  const loading = useDocumentsStore((s) => s.loading);
  const error = useDocumentsStore((s) => s.error);
  const hasFetched = useDocumentsStore((s) => s.hasFetched);
  const setDocuments = useDocumentsStore((s) => s.setDocuments);
  const removeDocument = useDocumentsStore((s) => s.removeDocument);
  const setLoading = useDocumentsStore((s) => s.setLoading);
  const setError = useDocumentsStore((s) => s.setError);
  const setHasFetched = useDocumentsStore((s) => s.setHasFetched);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const docs = await listDocuments.execute();
      setDocuments(docs);
      setHasFetched(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setError(`No se pudo cargar la lista de documentos: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [listDocuments, setDocuments, setError, setHasFetched, setLoading]);

  const remove = useCallback(
    async (id: number): Promise<void> => {
      try {
        await deleteDocument.execute(id);
        removeDocument(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo eliminar el documento: ${msg}`);
        throw err;
      }
    },
    [deleteDocument, removeDocument, setError],
  );

  const setPrimary = useCallback(
    async (id: number, value: boolean): Promise<void> => {
      // Snapshot for rollback in case the backend rejects the change.
      const snapshot = useDocumentsStore.getState().documents;
      const target = snapshot.find((d) => d.id === id);
      if (!target) return;

      // Optimistic UI: the toggled doc switches state. When marking as
      // primary, also unmark any other doc that shares the same scope so
      // the UI never shows two primaries at once. The backend is the
      // canonical authority — `refresh()` after success reconciles.
      const next = snapshot.map((d) => {
        if (d.id === id) {
          return { ...d, isPrimary: value };
        }
        if (
          value &&
          d.isPrimary &&
          d.scenario === target.scenario &&
          d.id !== id
        ) {
          return { ...d, isPrimary: false };
        }
        return d;
      });
      setDocuments(next);
      setError(null);

      try {
        await updateDocument.execute(id, { isPrimary: value });
      } catch (err) {
        // Rollback on failure (e.g. backend hasn't shipped is_primary yet).
        setDocuments(snapshot);
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo marcar como principal: ${msg}`);
        throw err;
      }
    },
    [updateDocument, setDocuments, setError],
  );

  // Gate fetch on authenticated user (auth store = single source of truth).
  const isAuthed = useAuthStore((s) => s.user !== null);

  // Dedup window — survives HMR via store-singleton state. Coexists with
  // `hasFetched` (which prevents the empty-state flash): we still skip
  // when the store is warm AND the timestamp is within the stale window.
  useEffect(() => {
    if (!isAuthed) return;
    const lastFetched = useDocumentsStore.getState().lastFetchedAt;
    if (
      hasFetched &&
      lastFetched !== null &&
      Date.now() - lastFetched < DOCUMENTS_STALE_MS
    ) {
      return;
    }
    if (loading) return;
    useDocumentsStore.getState().setLastFetchedAt(Date.now());
    void refresh().catch(() => {
      useDocumentsStore.getState().setLastFetchedAt(null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFetched, isAuthed]);

  return {
    documents,
    loading,
    error,
    hasFetched,
    hasCv: selectHasCv({ documents }),
    byType: selectByType({ documents }),
    refresh,
    remove,
    setPrimary,
  };
}
