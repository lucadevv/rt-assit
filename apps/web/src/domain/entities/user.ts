/**
 * User domain entity — TypeScript mirror of the backend `User` entity.
 *
 * Backend contract (python_backend/app/domain/entities/user.py exposed via
 * GET /api/me as `UserResponse`):
 *
 *   {
 *     id: string,                 // Clerk user_id or "dev_default"
 *     email: string,
 *     name: string | null,
 *     avatar_url: string | null,
 *     tier: "free" | "pro" | "premium" | "byok",
 *     language_preferred: string, // BCP-47 (default "es-419")
 *     created_at: string,         // ISO 8601 UTC
 *     updated_at: string
 *   }
 *
 * Frontend uses camelCase + ISO strings (no Date objects in domain — keeps
 * the layer free of timezone gotchas; presentation formats as needed).
 */

export type UserTier = "free" | "pro" | "premium" | "byok";

export interface User {
  id: string;
  email: string;
  name: string | null;
  avatarUrl: string | null;
  tier: UserTier;
  languagePreferred: string;
  createdAt: string;
  updatedAt: string;
}
