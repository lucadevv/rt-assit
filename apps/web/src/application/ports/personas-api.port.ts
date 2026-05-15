/**
 * PersonasApiPort — application contract for the personas REST surface.
 *
 * Backend reference (Phase H1, in parallel with H3):
 *   GET    /api/personas
 *   POST   /api/personas
 *   GET    /api/personas/{id}
 *   PATCH  /api/personas/{id}
 *   DELETE /api/personas/{id}
 *   POST   /api/personas/{id}/default
 *   POST   /api/personas/{id}/documents
 *   DELETE /api/personas/{id}/documents/{doc_id}
 *
 * Why a port:
 *  - Use cases consume this interface, not the concrete adapter, so they
 *    stay trivially mockable for unit tests (Clean Arch mandate).
 *  - Adapter handles snake_case ↔ camelCase mapping.
 *
 * Forward-compat: if the backend endpoints don't exist yet, the adapter
 * surfaces 404/405 errors and the presentation hook degrades gracefully
 * (empty list + error banner).
 */

import type { Persona, PersonaTone } from "@/domain/entities/persona";

export interface CreatePersonaInput {
  name: string;
  description?: string | null;
  scenarioId?: string | null;
  icon?: string | null;
  tone?: PersonaTone | null;
  customInstructions?: string | null;
}

export interface UpdatePersonaInput {
  name?: string;
  description?: string | null;
  scenarioId?: string | null;
  icon?: string | null;
  tone?: PersonaTone | null;
  customInstructions?: string | null;
}

export interface PersonasApiPort {
  list(): Promise<Persona[]>;
  create(input: CreatePersonaInput): Promise<Persona>;
  get(id: number): Promise<Persona>;
  update(id: number, input: UpdatePersonaInput): Promise<Persona>;
  delete(id: number): Promise<void>;
  setDefault(id: number): Promise<Persona>;
  linkDocument(
    id: number,
    documentId: number,
    isIdentity: boolean,
  ): Promise<void>;
  unlinkDocument(id: number, documentId: number): Promise<void>;
}
