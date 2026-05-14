// OAuth client contract for provider-specific authorization flows.
export const OAUTH_PROVIDERS = ["google", "microsoft", "zoom"] as const;
export type OAuthProviderId = (typeof OAUTH_PROVIDERS)[number];

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
