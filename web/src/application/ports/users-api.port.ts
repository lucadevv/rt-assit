/**
 * UsersApiPort — application contract for /api/me (PATCH + DELETE).
 *
 * F1 only needed the GET (handled by GetCurrentUserUseCase via the generic
 * ApiClient port). F6 introduces editing + GDPR delete, which justify a
 * dedicated port: it keeps the snake_case ↔ camelCase mapping confined to
 * the adapter layer and gives use cases a single typed surface.
 */

import type { User } from "@/domain/entities/user";

export interface UpdateUserProfileRequest {
  name?: string;
  languagePreferred?: string;
}

export interface UsersApiPort {
  update(req: UpdateUserProfileRequest): Promise<User>;
  /** GDPR data delete — DELETE /api/me. Resolves true when the row was
   * actually removed; backend may return false on idempotent re-deletes. */
  deleteSelf(): Promise<boolean>;
}
