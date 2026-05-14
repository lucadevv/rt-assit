"use client";

/**
 * usePersonas — single consumer of the personas list.
 *
 * Responsibilities:
 *  - Trigger the initial fetch on mount (only if the store hasn't been
 *    populated yet — both `/app/personas` and `NewSessionModal` use
 *    this hook, so they share one fetch).
 *  - Expose `refresh`, `create`, `update`, `remove`, `setDefault`
 *    handlers with optimistic store updates.
 *  - Surface failures via the store's `error` field so the page can
 *    render a banner. Errors do NOT crash the page — H1 backend may
 *    not yet expose `/api/personas`, in which case the list stays
 *    empty and the empty state is shown.
 */

import { useCallback, useEffect, useRef } from "react";
import { useContainer } from "@/infrastructure/di/container";
import {
  selectDefaultPersona,
  usePersonasStore,
} from "@/application/stores/personas.store";
import type { Persona } from "@/domain/entities/persona";
import type {
  CreatePersonaInput,
  UpdatePersonaInput,
} from "@/application/ports/personas-api.port";

interface UsePersonasResult {
  personas: Persona[];
  loading: boolean;
  error: string | null;
  hasFetched: boolean;
  defaultPersona: Persona | null;
  refresh: () => Promise<void>;
  create: (input: CreatePersonaInput) => Promise<Persona>;
  update: (id: number, input: UpdatePersonaInput) => Promise<Persona>;
  remove: (id: number) => Promise<void>;
  setDefault: (id: number) => Promise<void>;
  linkDocument: (
    personaId: number,
    documentId: number,
    isIdentity: boolean,
  ) => Promise<void>;
  unlinkDocument: (personaId: number, documentId: number) => Promise<void>;
}

export function usePersonas(): UsePersonasResult {
  const {
    listPersonas,
    createPersona,
    updatePersona,
    deletePersona,
    setDefaultPersona: setDefaultPersonaUc,
    linkPersonaDocument,
    unlinkPersonaDocument,
  } = useContainer();

  const personas = usePersonasStore((s) => s.personas);
  const loading = usePersonasStore((s) => s.loading);
  const error = usePersonasStore((s) => s.error);
  const hasFetched = usePersonasStore((s) => s.hasFetched);
  const setPersonas = usePersonasStore((s) => s.setPersonas);
  const upsertPersona = usePersonasStore((s) => s.upsertPersona);
  const removePersona = usePersonasStore((s) => s.removePersona);
  const markDefault = usePersonasStore((s) => s.markDefault);
  const setLoading = usePersonasStore((s) => s.setLoading);
  const setError = usePersonasStore((s) => s.setError);
  const setHasFetched = usePersonasStore((s) => s.setHasFetched);

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const list = await listPersonas.execute();
      setPersonas(list);
      setHasFetched(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      // H1 may not have shipped the endpoint yet — degrade gracefully:
      // empty list + banner, no crash.
      setPersonas([]);
      setHasFetched(true);
      setError(`No se pudo cargar las personas: ${msg}`);
    } finally {
      setLoading(false);
    }
  }, [listPersonas, setPersonas, setError, setHasFetched, setLoading]);

  const create = useCallback(
    async (input: CreatePersonaInput): Promise<Persona> => {
      try {
        const created = await createPersona.execute(input);
        upsertPersona(created);
        setError(null);
        return created;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo crear la persona: ${msg}`);
        throw err;
      }
    },
    [createPersona, upsertPersona, setError],
  );

  const update = useCallback(
    async (id: number, input: UpdatePersonaInput): Promise<Persona> => {
      try {
        const updated = await updatePersona.execute(id, input);
        upsertPersona(updated);
        setError(null);
        return updated;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo actualizar la persona: ${msg}`);
        throw err;
      }
    },
    [updatePersona, upsertPersona, setError],
  );

  const remove = useCallback(
    async (id: number): Promise<void> => {
      try {
        await deletePersona.execute(id);
        removePersona(id);
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo eliminar la persona: ${msg}`);
        throw err;
      }
    },
    [deletePersona, removePersona, setError],
  );

  const setDefault = useCallback(
    async (id: number): Promise<void> => {
      // Optimistic UI: flip the default flag immediately, reconcile on
      // success. Roll back on failure.
      const snapshot = usePersonasStore.getState().personas;
      markDefault(id);
      try {
        await setDefaultPersonaUc.execute(id);
        setError(null);
      } catch (err) {
        usePersonasStore.getState().setPersonas(snapshot);
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo marcar como predeterminada: ${msg}`);
        throw err;
      }
    },
    [setDefaultPersonaUc, markDefault, setError],
  );

  const linkDocument = useCallback(
    async (
      personaId: number,
      documentId: number,
      isIdentity: boolean,
    ): Promise<void> => {
      try {
        await linkPersonaDocument.execute(personaId, documentId, isIdentity);
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo vincular el documento: ${msg}`);
        throw err;
      }
    },
    [linkPersonaDocument, setError],
  );

  const unlinkDocument = useCallback(
    async (personaId: number, documentId: number): Promise<void> => {
      try {
        await unlinkPersonaDocument.execute(personaId, documentId);
        setError(null);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error desconocido";
        setError(`No se pudo desvincular el documento: ${msg}`);
        throw err;
      }
    },
    [unlinkPersonaDocument, setError],
  );

  // StrictMode dedup — see use-documents.ts for the rationale.
  const fetchedRef = useRef(false);
  useEffect(() => {
    if (fetchedRef.current) return;
    if (!hasFetched && !loading) {
      fetchedRef.current = true;
      void refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFetched]);

  return {
    personas,
    loading,
    error,
    hasFetched,
    defaultPersona: selectDefaultPersona({ personas }),
    refresh,
    create,
    update,
    remove,
    setDefault,
    linkDocument,
    unlinkDocument,
  };
}
