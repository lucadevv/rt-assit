"use client";

/**
 * useSessionMaterials — list + mutate the materials attached to a session.
 *
 * Used by the session-detail surfaces (and potentially the live page) to
 * read what the user attached in the NewSessionModal. Local state — no
 * Zustand store needed; the materials are scoped to a single session id
 * and the page mounts/unmounts with it.
 *
 * NOTE: The NewSessionModal does NOT use this hook — it keeps drafts in
 * pure local React state and POSTs them sequentially after the session
 * row is created (via the `createSessionMaterial` use case directly).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useContainer } from "@/infrastructure/di/container";
import type { SessionMaterial } from "@/domain/entities/session-material";
import type { CreateSessionMaterialInput } from "@/application/ports/session-materials-api.port";

interface UseSessionMaterialsResult {
  materials: SessionMaterial[];
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
  refresh: () => Promise<void>;
  add: (input: CreateSessionMaterialInput) => Promise<SessionMaterial>;
  remove: (materialId: number) => Promise<void>;
}

export function useSessionMaterials(
  sessionId: string | null,
): UseSessionMaterialsResult {
  const {
    listSessionMaterials,
    createSessionMaterial,
    deleteSessionMaterial,
  } = useContainer();

  const [materials, setMaterials] = useState<SessionMaterial[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasFetched, setHasFetched] = useState(false);

  const refresh = useCallback(async (): Promise<void> => {
    if (!sessionId) return;
    setLoading(true);
    setError(null);
    try {
      const list = await listSessionMaterials.execute(sessionId);
      setMaterials(list);
      setHasFetched(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      setMaterials([]);
      setHasFetched(true);
      setError(`No se pudo cargar el material de la sesión: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [listSessionMaterials, sessionId]);

  const add = useCallback(
    async (input: CreateSessionMaterialInput): Promise<SessionMaterial> => {
      if (!sessionId) {
        throw new Error("Falta el sessionId para agregar material.");
      }
      try {
        const created = await createSessionMaterial.execute(sessionId, input);
        setMaterials((prev) => [created, ...prev]);
        setError(null);
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo agregar el material: ${msg}`);
        throw err;
      }
    },
    [createSessionMaterial, sessionId],
  );

  const remove = useCallback(
    async (materialId: number): Promise<void> => {
      if (!sessionId) {
        throw new Error("Falta el sessionId para eliminar material.");
      }
      try {
        await deleteSessionMaterial.execute(sessionId, materialId);
        setMaterials((prev) => prev.filter((m) => m.id !== materialId));
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo eliminar el material: ${msg}`);
        throw err;
      }
    },
    [deleteSessionMaterial, sessionId],
  );

  // StrictMode dedup — fetch once per sessionId.
  const fetchedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!sessionId) {
      fetchedRef.current = null;
      setMaterials([]);
      setHasFetched(false);
      return;
    }
    if (fetchedRef.current === sessionId) return;
    fetchedRef.current = sessionId;
    void refresh();
  }, [sessionId, refresh]);

  return {
    materials,
    loading,
    error,
    hasFetched,
    refresh,
    add,
    remove,
  };
}
