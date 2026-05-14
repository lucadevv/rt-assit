"use client";

/**
 * useDocumentDetail — fetches the full content of a single doc on demand
 * (used by the preview + edit modals). Keeps a tiny local cache keyed by
 * id so reopening the same doc doesn't refetch.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { Document } from "@/domain/entities/document";

interface UseDocumentDetailResult {
  doc: Document | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useDocumentDetail(id: number | null): UseDocumentDetailResult {
  const { getDocument } = useContainer();
  const [doc, setDoc] = useState<Document | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef(new Map<number, Document>());

  const fetchDoc = useCallback(
    (docId: number) => {
      const cached = cacheRef.current.get(docId);
      if (cached) {
        setDoc(cached);
        setLoading(false);
        setError(null);
        return;
      }
      setLoading(true);
      setError(null);
      getDocument
        .execute(docId)
        .then((d) => {
          cacheRef.current.set(docId, d);
          setDoc(d);
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : "Error desconocido";
          setError(`No se pudo cargar el documento: ${msg}`);
          setDoc(null);
        })
        .finally(() => setLoading(false));
    },
    [getDocument],
  );

  useEffect(() => {
    if (id == null) {
      setDoc(null);
      setError(null);
      return;
    }
    fetchDoc(id);
  }, [id, fetchDoc]);

  const refetch = useCallback(() => {
    if (id != null) {
      cacheRef.current.delete(id);
      fetchDoc(id);
    }
  }, [id, fetchDoc]);

  return { doc, loading, error, refetch };
}
