// OAuth client contract for provider-specific authorization flows.
//
// `OAuthProviderId` lives in `@/domain/entities/oauth-integration` as the
// single source of truth (it's a domain primitive). This module re-exports
// it for backward compatibility with existing consumers (e.g. the meeting
// provider factory port).
import {
  OAUTH_PROVIDERS,
  type OAuthProviderId,
} from "@/domain/entities/oauth-integration";

export { OAUTH_PROVIDERS };
export type { OAuthProviderId };

export interface OAuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

export interface OAuthClient {
  readonly provider: OAuthProviderId;
  getAuthorizationUrl(state: string): string;
  exchangeCode(code: string): Promise<OAuthTokens>;
  refreshAccessToken(refreshToken: string): Promise<OAuthTokens>;
  revoke(refreshToken: string): Promise<void>;
}
