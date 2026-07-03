/**
 * UsersApiAdapter — concrete `UsersApiPort` implementation.
 *
 * Backend reference (python_backend/app/presentation/api/me_router.py):
 *  - PATCH  /api/me  → UserResponse  (partial body: name, language_preferred)
 *  - DELETE /api/me  → DeleteResponse { deleted: boolean }
 *
 * Responsibilities:
 *  - snake_case ↔ camelCase mapping for both directions.
 *  - Tier normalisation (defensive — backend may add new tiers).
 *
 * F1's GetCurrentUserUseCase already maps the GET shape; we redeclare the
 * tiny mapper here so this adapter is self-contained.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  UpdateUserProfileRequest,
  UsersApiPort,
} from "@/application/ports/users-api.port";
import type { User, UserTier } from "@/domain/entities/user";

interface MeResponseRaw {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  tier: string;
  language_preferred: string;
  created_at: string;
  updated_at: string;
  is_admin?: boolean;
}

interface DeleteResponseRaw {
  deleted: boolean;
}

const VALID_TIERS: readonly UserTier[] = ["free", "pro", "premium", "byok"];

function normaliseTier(raw: string): UserTier {
  return (VALID_TIERS as readonly string[]).includes(raw)
    ? (raw as UserTier)
    : "free";
}

function mapUser(raw: MeResponseRaw): User {
  return {
    id: raw.id,
    email: raw.email,
    name: raw.name,
    avatarUrl: raw.avatar_url,
    tier: normaliseTier(raw.tier),
    languagePreferred: raw.language_preferred,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    isAdmin: raw.is_admin ?? false,
  };
}

export class UsersApiAdapter implements UsersApiPort {
  constructor(private readonly api: ApiClient) {}

  async update(req: UpdateUserProfileRequest): Promise<User> {
    const body: Record<string, unknown> = {};
    if (req.name !== undefined) body["name"] = req.name;
    if (req.languagePreferred !== undefined)
      body["language_preferred"] = req.languagePreferred;
    const raw = await this.api.patch<MeResponseRaw>("/api/me", body);
    return mapUser(raw);
  }

  async deleteSelf(): Promise<boolean> {
    const raw = await this.api.delete<DeleteResponseRaw>("/api/me");
    return raw.deleted;
  }
}

export const __testing = { mapUser };
