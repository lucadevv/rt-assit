// Factory contract that builds a MeetingProvider for a given user + provider id.
import type { MeetingProvider } from "./meeting-provider.port";
import type { MeetingProviderId } from "@/domain/entities/meeting-provider-id";
import type { OAuthProviderId, OAuthTokens } from "./oauth-client.port";

export interface UserContext {
  userId: string;
  oauthTokens: Partial<Record<OAuthProviderId, OAuthTokens>>;
}

export interface MeetingProviderFactory {
  create(providerId: MeetingProviderId, ctx: UserContext): MeetingProvider;
}
