/**
 * GetCurrentUserUseCase — fetch the authenticated user from the backend.
 *
 * Backend contract: GET /api/me returns `UserResponse` (snake_case). This
 * use case maps it to the domain `User` (camelCase). All transport-layer
 * details (auth headers, base URL) are owned by the ApiClient adapter.
 *
 * Why a use case (not a hook calling fetch directly):
 *   - Domain layer is the source of truth for the User shape.
 *   - This is the only place the snake_case → camelCase mapping lives.
 *   - Future: enrich response (e.g. merge with cached preferences) without
 *     touching presentation.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type { User, UserTier } from "@/domain/entities/user";

interface MeResponse {
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

const VALID_TIERS: readonly UserTier[] = ["free", "pro", "premium", "byok"];

function normaliseTier(raw: string): UserTier {
  return (VALID_TIERS as readonly string[]).includes(raw)
    ? (raw as UserTier)
    : "free";
}

export class GetCurrentUserUseCase {
  constructor(private readonly api: ApiClient) {}

  async execute(): Promise<User> {
    const raw = await this.api.get<MeResponse>("/api/me");
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
}
