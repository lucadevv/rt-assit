/**
 * PersonasApiAdapter — concrete `PersonasApiPort` impl backed by `ApiClient`.
 *
 * Backend reference (Phase H1, in parallel — may not exist yet at the
 * moment of first call. The use case lets non-2xx errors bubble up and
 * the presentation hook degrades gracefully).
 *
 *   GET    /api/personas
 *   POST   /api/personas
 *   GET    /api/personas/{id}
 *   PATCH  /api/personas/{id}
 *   DELETE /api/personas/{id}
 *   POST   /api/personas/{id}/default
 *   POST   /api/personas/{id}/documents      body: { document_id, is_identity }
 *   DELETE /api/personas/{id}/documents/{doc_id}
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping (application stays clean).
 *  - Normalise tone (only accept known values; otherwise null).
 *
 * NOTE: Clean Arch — this file is the ONLY consumer of `ApiClient`
 * concrete details for personas. Use cases consume the port, never the
 * adapter directly.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  CreatePersonaInput,
  PersonasApiPort,
  UpdatePersonaInput,
} from "@/application/ports/personas-api.port";
import type { Persona, PersonaTone } from "@/domain/entities/persona";
import { isPersonaTone } from "@/domain/entities/persona";

interface PersonaResponseRaw {
  id: number;
  user_id: string;
  name: string;
  description: string | null;
  scenario_id: string | null;
  icon: string | null;
  tone: string | null;
  custom_instructions: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

function normaliseTone(raw: string | null): PersonaTone | null {
  if (raw === null) return null;
  return isPersonaTone(raw) ? raw : null;
}

function mapPersona(raw: PersonaResponseRaw): Persona {
  return {
    id: raw.id,
    userId: raw.user_id,
    name: raw.name,
    description: raw.description,
    scenarioId: raw.scenario_id,
    icon: raw.icon,
    tone: normaliseTone(raw.tone),
    customInstructions: raw.custom_instructions,
    isDefault: raw.is_default === true,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}

function toCreateBody(input: CreatePersonaInput): Record<string, unknown> {
  const body: Record<string, unknown> = { name: input.name };
  if (input.description !== undefined) body["description"] = input.description;
  if (input.scenarioId !== undefined) body["scenario_id"] = input.scenarioId;
  if (input.icon !== undefined) body["icon"] = input.icon;
  if (input.tone !== undefined) body["tone"] = input.tone;
  if (input.customInstructions !== undefined) {
    body["custom_instructions"] = input.customInstructions;
  }
  return body;
}

function toUpdateBody(input: UpdatePersonaInput): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (input.name !== undefined) body["name"] = input.name;
  if (input.description !== undefined) body["description"] = input.description;
  if (input.scenarioId !== undefined) body["scenario_id"] = input.scenarioId;
  if (input.icon !== undefined) body["icon"] = input.icon;
  if (input.tone !== undefined) body["tone"] = input.tone;
  if (input.customInstructions !== undefined) {
    body["custom_instructions"] = input.customInstructions;
  }
  return body;
}

export class PersonasApiAdapter implements PersonasApiPort {
  constructor(private readonly api: ApiClient) {}

  async list(): Promise<Persona[]> {
    const raw = await this.api.get<PersonaResponseRaw[]>("/api/personas");
    return raw.map(mapPersona);
  }

  async create(input: CreatePersonaInput): Promise<Persona> {
    const raw = await this.api.post<PersonaResponseRaw>(
      "/api/personas",
      toCreateBody(input),
    );
    return mapPersona(raw);
  }

  async get(id: number): Promise<Persona> {
    const raw = await this.api.get<PersonaResponseRaw>(`/api/personas/${id}`);
    return mapPersona(raw);
  }

  async update(id: number, input: UpdatePersonaInput): Promise<Persona> {
    const raw = await this.api.patch<PersonaResponseRaw>(
      `/api/personas/${id}`,
      toUpdateBody(input),
    );
    return mapPersona(raw);
  }

  async delete(id: number): Promise<void> {
    await this.api.delete<{ deleted: boolean }>(`/api/personas/${id}`);
  }

  async setDefault(id: number): Promise<Persona> {
    const raw = await this.api.post<PersonaResponseRaw>(
      `/api/personas/${id}/default`,
    );
    return mapPersona(raw);
  }

  async linkDocument(
    id: number,
    documentId: number,
    isIdentity: boolean,
  ): Promise<void> {
    await this.api.post<{ linked: boolean }>(`/api/personas/${id}/documents`, {
      document_id: documentId,
      is_identity: isIdentity,
    });
  }

  async unlinkDocument(id: number, documentId: number): Promise<void> {
    await this.api.delete<{ unlinked: boolean }>(
      `/api/personas/${id}/documents/${documentId}`,
    );
  }
}

export const __testing = { mapPersona, toCreateBody, toUpdateBody };
