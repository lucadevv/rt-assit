/**
 * UpdatePreferencesUseCase — partial PATCH of user preferences.
 *
 * The use case is intentionally generic: presentation already knows which
 * fields to send (theme switch, audio device select, auto-delete number,
 * etc.) and the backend treats omitted fields as unchanged. `audioDeviceId`
 * + `autoDeleteRecordingsDays` admit explicit `null` to reset; the adapter
 * forwards them as JSON `null` so the backend's `model_fields_set` check
 * recognises an explicit reset.
 */

import type { PreferencesApiPort } from "@/application/ports/preferences-api.port";
import type {
  UpdateUserPreferences,
  UserPreferences,
} from "@/domain/entities/user-preferences";

export class UpdatePreferencesUseCase {
  constructor(private readonly api: PreferencesApiPort) {}

  execute(req: UpdateUserPreferences): Promise<UserPreferences> {
    return this.api.update(req);
  }
}
