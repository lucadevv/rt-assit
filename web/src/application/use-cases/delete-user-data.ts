/**
 * DeleteUserDataUseCase — GDPR data delete (FR-110).
 *
 * Calls DELETE /api/me which cascades to user preferences, documents,
 * sessions, recordings, etc. The presentation layer is expected to
 * confirm with the user before invoking this (the Settings UI requires
 * the user to type their email exactly).
 *
 * Returns true when the row was deleted. The caller should sign out and
 * route to /sign-in afterwards regardless — once the row is gone, every
 * subsequent /api/me call will recreate a default user (dev) or 401
 * (Clerk).
 */

import type { UsersApiPort } from "@/application/ports/users-api.port";

export class DeleteUserDataUseCase {
  constructor(private readonly api: UsersApiPort) {}

  execute(): Promise<boolean> {
    return this.api.deleteSelf();
  }
}
