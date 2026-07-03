/**
 * MarkOnboardingCompleteUseCase — flip `onboarding_complete=true` on the
 * server when the user finishes (or explicitly skips) the /app/onboarding
 * wizard.
 *
 * Backed by POST /api/me/onboarding/complete (idempotent). The endpoint
 * returns the full UserPreferences so consumers can replace their cache
 * in one round-trip — useful for `useOnboardingStatus` which reads the
 * flag directly off the cached preferences.
 */

import type { PreferencesApiPort } from "@/application/ports/preferences-api.port";
import type { UserPreferences } from "@/domain/entities/user-preferences";

export class MarkOnboardingCompleteUseCase {
  constructor(private readonly api: PreferencesApiPort) {}

  execute(): Promise<UserPreferences> {
    return this.api.markOnboardingComplete();
  }
}
