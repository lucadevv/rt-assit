/**
 * Thrown when the FetchApiClient cannot reach the backend during a 401
 * refresh attempt (fetch threw — offline, DNS failure, CORS preflight
 * rejection, etc.). Distinguished from {@link SessionExpiredError}
 * because the UX response should differ:
 *
 *   SessionExpiredError → hard-nav to /sign-in (refresh token rejected by
 *     server; user must reauthenticate).
 *   NetworkError → keep current UI mounted, show "you're offline" affordance.
 *     The session may still be valid; we just can't prove it right now.
 *
 * Catchers should preserve the in-memory auth state on NetworkError and
 * retry on the next user interaction (or network status change).
 */
export class NetworkError extends Error {
  constructor(message: string = "network_error") {
    super(message);
    this.name = "NetworkError";
  }
}
