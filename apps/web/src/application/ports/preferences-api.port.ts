/**
 * PreferencesApiPort — application contract for /api/preferences.
 *
 * Use cases depend on this interface, not on the concrete HTTP adapter,
 * so they remain mockable for unit tests and free of `fetch` details.
 */

import type {
  UpdateUserPreferences,
  UserPreferences,
} from "@/domain/entities/user-preferences";

export interface PreferencesApiPort {
  get(): Promise<UserPreferences>;
  update(req: UpdateUserPreferences): Promise<UserPreferences>;
  /**
   * Idempotently flip `onboarding_complete=true` for the current user.
   * Backed by POST /api/me/onboarding/complete. Returns the full
   * UserPreferences so callers can replace their cache in one call.
   */
  markOnboardingComplete(): Promise<UserPreferences>;
}
