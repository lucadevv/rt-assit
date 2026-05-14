/**
 * Scenario domain entity — backend `ScenarioSummary` mirror.
 *
 * Backend contract (Wave 1A — GET /api/scenarios returns `ScenarioSummary[]`):
 *
 *   {
 *     id: string,
 *     label: string,
 *     doc_types: string[],   // = relevant_doc_types on backend
 *     description: string,
 *     color: string          // semantic color name (cyan/amber/lavender/lime)
 *   }
 *
 * `ScenarioId` is left as a union of well-known IDs + open string so custom
 * scenarios (FR-72) work without TS friction. `ScenarioColor` mirrors the
 * scenario→color map established in B3 (cyan=interview, amber=client/sales,
 * lavender=oral, lime=personal/brand) used by REC badge + speaker labels.
 *
 * `description` and `color` default to safe values so older backends that
 * don't yet return them still parse cleanly.
 */

export type ScenarioId =
  | "interview_dev"
  | "interview_behavioral"
  | "meeting_business"
  | "client_call"
  | "sales_call"
  | "exam_oral"
  | "thesis_defense"
  | "personal"
  | string;

export type ScenarioColor = "cyan" | "amber" | "lavender" | "lime";

export interface Scenario {
  id: ScenarioId;
  label: string;
  doc_types: readonly string[];
  description?: string;
  color?: string;
}

const SCENARIO_COLORS: ReadonlySet<ScenarioColor> = new Set([
  "cyan",
  "amber",
  "lavender",
  "lime",
]);

/**
 * Map a scenario id to its Auri brand color (B3 convention).
 *
 * If the scenario object exposes `color` (Wave 1A backend), we trust it.
 * Otherwise we fall back to the legacy heuristic by id.
 */
export function scenarioColorOf(
  idOrScenario: ScenarioId | Scenario,
): ScenarioColor {
  if (typeof idOrScenario === "object" && idOrScenario !== null) {
    const raw = idOrScenario.color;
    if (raw && SCENARIO_COLORS.has(raw as ScenarioColor)) {
      return raw as ScenarioColor;
    }
    return scenarioColorOfId(idOrScenario.id);
  }
  return scenarioColorOfId(idOrScenario);
}

function scenarioColorOfId(id: ScenarioId): ScenarioColor {
  if (id === "interview_dev" || id === "interview_behavioral") return "cyan";
  if (id === "meeting_business" || id === "sales_call" || id === "client_call")
    return "amber";
  if (id === "exam_oral" || id === "thesis_defense") return "lavender";
  return "lime";
}
