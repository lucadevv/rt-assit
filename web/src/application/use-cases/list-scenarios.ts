/**
 * ListScenariosUseCase — fetch the catalog of scenarios available to the
 * current user (FR-7).
 *
 * Backend contract (Wave 1A): GET /api/scenarios returns `ScenarioSummary[]`:
 *   [{ id, label, doc_types, description, color }]
 *
 * The shape matches the domain `Scenario` interface 1:1 (no remapping
 * needed) so this use case is mostly a typed wrapper around the API call.
 * `description` and `color` are optional on the domain entity to keep us
 * forward-compat with older backends that don't yet surface them.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type { Scenario } from "@/domain/entities/scenario";

interface ScenarioRaw {
  id: string;
  label: string;
  doc_types: string[];
  description?: string;
  color?: string;
}

export class ListScenariosUseCase {
  constructor(private readonly api: ApiClient) {}

  async execute(): Promise<Scenario[]> {
    const raw = await this.api.get<ScenarioRaw[]>("/api/scenarios");
    return raw.map((s) => ({
      id: s.id,
      label: s.label,
      doc_types: s.doc_types ?? [],
      description: s.description ?? "",
      color: s.color ?? "lime",
    }));
  }
}
