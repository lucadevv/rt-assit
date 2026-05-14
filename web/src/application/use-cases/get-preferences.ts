/**
 * GetPreferencesUseCase — fetch the current user's UserPreferences.
 *
 * Thin wrapper around PreferencesApiPort.get. Exists as a class so it
 * matches the F1+ pattern (every entry-point in application/use-cases
 * exposes an `execute()` method) and so the composition root wires it
 * exactly like the rest of the use cases.
 */

import type { PreferencesApiPort } from "@/application/ports/preferences-api.port";
import type { UserPreferences } from "@/domain/entities/user-preferences";

export class GetPreferencesUseCase {
  constructor(private readonly api: PreferencesApiPort) {}

  execute(): Promise<UserPreferences> {
    return this.api.get();
  }
}
