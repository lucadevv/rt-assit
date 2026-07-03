/**
 * Documents store (Zustand 5) — owns the KB list shown on /app/knowledge.
 *
 * Why a store (instead of per-page state):
 *  - The TopBar `KbStatusIndicator` reads `hasCv` from the same source the
 *    /app/knowledge page lists — single fetch, single source of truth.
 *  - Optimistic add/remove on upload/delete keeps the UI responsive.
 *
 * No infrastructure imports here — domain types only.
 */

import { create } from "zustand";
import type { DocType, DocumentListItem } from "@/domain/entities/document";
import { ALL_DOC_TYPES } from "@/domain/entities/document";

interface DocumentsStoreState {
  documents: DocumentListItem[];
  loading: boolean;
  error: string | null;
  /** True after the first successful list() fetch — prevents flashing
   * the empty state during initial load. */
  hasFetched: boolean;
  /** Dedup window — survives HMR via store-singleton state. */
  lastFetchedAt: number | null;
  selectedDocId: number | null;

  setDocuments: (docs: DocumentListItem[]) => void;
  addDocument: (doc: DocumentListItem) => void;
  removeDocument: (id: number) => void;
  upsertDocument: (doc: DocumentListItem) => void;
  setLoading: (v: boolean) => void;
  setError: (e: string | null) => void;
  setHasFetched: (v: boolean) => void;
  setLastFetchedAt: (timestamp: number | null) => void;
  selectDoc: (id: number | null) => void;
  reset: () => void;
}

export const useDocumentsStore = create<DocumentsStoreState>((set) => ({
  documents: [],
  loading: false,
  error: null,
  hasFetched: false,
  lastFetchedAt: null,
  selectedDocId: null,

  setDocuments: (docs) => set({ documents: docs }),

  addDocument: (doc) =>
    set((state) => {
      // Avoid dupe if the id is already there (optimistic vs server confirm).
      if (state.documents.some((d) => d.id === doc.id)) {
        return state;
      }
      return { documents: [doc, ...state.documents] };
    }),

  removeDocument: (id) =>
    set((state) => ({
      documents: state.documents.filter((d) => d.id !== id),
      selectedDocId: state.selectedDocId === id ? null : state.selectedDocId,
    })),

  upsertDocument: (doc) =>
    set((state) => {
      const idx = state.documents.findIndex((d) => d.id === doc.id);
      if (idx === -1) {
        return { documents: [doc, ...state.documents] };
      }
      const next = state.documents.slice();
      next[idx] = doc;
      return { documents: next };
    }),

  setLoading: (v) => set({ loading: v }),
  setError: (e) => set({ error: e }),
  setHasFetched: (v) => set({ hasFetched: v }),
  setLastFetchedAt: (lastFetchedAt) => set({ lastFetchedAt }),
  selectDoc: (id) => set({ selectedDocId: id }),

  reset: () =>
    set({
      documents: [],
      loading: false,
      error: null,
      hasFetched: false,
      lastFetchedAt: null,
      selectedDocId: null,
    }),
}));

/**
 * Selector helpers — pure functions kept colocated with the store so
 * components can use them without redefining the same memoization.
 */

export function selectHasCv(state: { documents: DocumentListItem[] }): boolean {
  return state.documents.some((d) => d.docType === "cv");
}

/**
 * Group documents by docType, preserving the canonical doc-type ordering.
 * Returns a Map (not Record) for deterministic iteration order.
 */
export function selectByType(state: {
  documents: DocumentListItem[];
}): Map<DocType, DocumentListItem[]> {
  const map = new Map<DocType, DocumentListItem[]>();
  for (const t of ALL_DOC_TYPES) {
    map.set(t, []);
  }
  for (const doc of state.documents) {
    const bucket = map.get(doc.docType);
    if (bucket) {
      bucket.push(doc);
    } else {
      map.set(doc.docType, [doc]);
    }
  }
  return map;
}
