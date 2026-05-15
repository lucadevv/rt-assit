/**
 * CheckFeatureAvailabilityUseCase — pure derivation of feature gating
 * from a Plan + 14 declarative feature names.
 *
 * This use case has NO side effects and NO dependencies — it inspects
 * `plan.limits` (already loaded by `useBilling`) and answers the
 * question "is this feature unlocked for the current plan?". The
 * `useTierGate(feature)` hook is the consumer; UI components call it
 * from anywhere in the app to lock features behind a paywall.
 *
 * Mapping rules (mirror backend FREE/PRO/PREMIUM/BYOK_LIMITS):
 *  - boolean flags map directly (diarization_enabled, voice_*_enabled,
 *    stealth_mode, byok_enabled, priority_support).
 *  - count limits with `null` mean "unlimited" → unlocked.
 *  - count limits with `0` mean "blocked entirely" → locked.
 *  - count limits with positive integer mean "metered" → unlocked
 *    (the actual quota check happens server-side).
 *  - tweaks unlock when the unlocked array has the full set
 *    (>=3 entries == all 3 styles unlocked).
 *  - export_formats unlocks pdf when `pdf` is in the array.
 *
 * Required tier mapping:
 *   - voice_fingerprinting + stealth_mode → premium
 *   - byok                                → byok
 *   - everything else (when locked)       → pro
 *
 * Returns FeatureAvailability so the hook can render an upgrade banner
 * pointing at the cheapest plan that unlocks the feature.
 */

import type { Plan, PlanLimits } from "@/domain/entities/plan";

export type Feature =
  | "unlimited_sessions"
  | "unlimited_docs"
  | "recordings"
  | "diarization"
  | "voice_fingerprinting"
  | "stealth_mode"
  | "byok"
  | "priority_support"
  | "pdf_export"
  | "all_layouts"
  | "all_hint_styles"
  | "all_transcript_styles"
  | "share_links"
  | "custom_scenarios";

export type RequiredTier = "pro" | "premium" | "byok";

export type UnavailableReason =
  | "no_subscription"
  | "tier_upgrade_required"
  | "limit_reached";

export interface FeatureAvailability {
  available: boolean;
  reason?: UnavailableReason;
  requiredTier?: RequiredTier;
}

const lock = (requiredTier: RequiredTier): FeatureAvailability => ({
  available: false,
  reason: "tier_upgrade_required",
  requiredTier,
});
const unlock = (): FeatureAvailability => ({ available: true });

export class CheckFeatureAvailabilityUseCase {
  execute(feature: Feature, plan: Plan | null): FeatureAvailability {
    if (!plan) return { available: false, reason: "no_subscription" };

    const l: PlanLimits = plan.limits;

    switch (feature) {
      case "unlimited_sessions":
        return l.max_session_duration_minutes === null ? unlock() : lock("pro");
      case "unlimited_docs":
        return l.max_docs === null ? unlock() : lock("pro");
      case "recordings":
        // null = unlimited, 0 = blocked, positive = metered
        return (l.max_recordings ?? 1) !== 0 ? unlock() : lock("pro");
      case "diarization":
        return l.diarization_enabled ? unlock() : lock("pro");
      case "voice_fingerprinting":
        return l.voice_fingerprinting_enabled ? unlock() : lock("premium");
      case "stealth_mode":
        return l.stealth_mode ? unlock() : lock("premium");
      case "byok":
        return l.byok_enabled ? unlock() : lock("byok");
      case "priority_support":
        return l.priority_support ? unlock() : lock("pro");
      case "pdf_export":
        return l.export_formats.includes("pdf") ? unlock() : lock("pro");
      case "all_layouts":
        return l.tweaks_layouts_unlocked.length >= 3 ? unlock() : lock("pro");
      case "all_hint_styles":
        return l.tweaks_hint_styles_unlocked.length >= 3
          ? unlock()
          : lock("pro");
      case "all_transcript_styles":
        return l.tweaks_transcript_styles_unlocked.length >= 3
          ? unlock()
          : lock("pro");
      case "share_links":
        return (l.max_share_links ?? 1) !== 0 ? unlock() : lock("pro");
      case "custom_scenarios":
        return (l.max_custom_scenarios ?? 1) !== 0 ? unlock() : lock("pro");
      default: {
        // Exhaustiveness check — if this ever throws, a new Feature was
        // added without a matching case here.
        const exhaustive: never = feature;
        void exhaustive;
        return { available: false, reason: "tier_upgrade_required" };
      }
    }
  }
}
