/**
 * UpdateUserProfileUseCase — PATCH /api/me with name + language_preferred.
 *
 * Wraps UsersApiPort.update so the snake_case ↔ camelCase translation
 * stays confined to the adapter layer. Returns the refreshed User so the
 * presentation layer can update the auth store atomically.
 */

import type {
  UpdateUserProfileRequest,
  UsersApiPort,
} from "@/application/ports/users-api.port";
import type { User } from "@/domain/entities/user";

export class UpdateUserProfileUseCase {
  constructor(private readonly api: UsersApiPort) {}

  execute(req: UpdateUserProfileRequest): Promise<User> {
    return this.api.update(req);
  }
}
