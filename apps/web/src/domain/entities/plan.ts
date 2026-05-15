/**
 * Plan domain entity — TypeScript mirror of the backend `Plan` entity.
 *
 * Backend contract (python_backend/app/domain/entities/plan.py exposed via
 * GET /api/plans as `PlanResponse`):
 *
 *   {
 *     id: string,                    // e.g. "free", "pro_monthly", ...
 *     code: "free" | "pro" | "premium" | "byok",
 *     name: string,
 *     description: string | null,
 *     price_cents: integer,
 *     currency: string,              // "USD"
 *     billing_cycle: "free" | "monthly" | "yearly" | "lifetime",
 *     limits: {
 *       max_session_duration_minutes: number | null,  // null = unlimited
 *       max_minutes_per_month: number | null,
 *       max_docs: number | null,
 *       max_recordings: number | null,                // 0 = blocked
 *       max_storage_gb: number,
 *       max_share_links: number | null,
 *       max_custom_scenarios: number | null,
 *       diarization_enabled: boolean,
 *       voice_fingerprinting_enabled: boolean,
 *       tweaks_layouts_unlocked: string[],
 *       tweaks_hint_styles_unlocked: string[],
 *       tweaks_transcript_styles_unlocked: string[],
 *       byok_enabled: boolean,
 *       priority_support: boolean,
 *       export_formats: string[],
 *       stealth_mode: boolean
 *     },
 *     is_active: boolean,
 *     is_legacy: boolean,
 *     sort_order: number
 *   }
 *
 * Frontend uses camelCase + integer cents (money) and re-exposes
 * `limits` in snake_case to match the backend `PlanLimits` shape.
 */

export type PlanCode = "free" | "pro" | "premium" | "byok";
export type BillingCycle = "free" | "monthly" | "yearly" | "lifetime";

export interface PlanLimits {
  max_session_duration_minutes: number | null;
  max_minutes_per_month: number | null;
  max_docs: number | null;
  max_recordings: number | null;
  max_storage_gb: number;
  max_share_links: number | null;
  max_custom_scenarios: number | null;
  diarization_enabled: boolean;
  voice_fingerprinting_enabled: boolean;
  tweaks_layouts_unlocked: string[];
  tweaks_hint_styles_unlocked: string[];
  tweaks_transcript_styles_unlocked: string[];
  byok_enabled: boolean;
  priority_support: boolean;
  export_formats: string[];
  stealth_mode: boolean;
}

export interface Plan {
  id: string;
  code: PlanCode;
  name: string;
  description: string | null;
  priceCents: number;
  currency: string;
  billingCycle: BillingCycle;
  limits: PlanLimits;
  isActive: boolean;
  isLegacy: boolean;
  sortOrder: number;
}
