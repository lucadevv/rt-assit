/**
 * Thrown when the FetchApiClient's 401 interceptor tries to refresh and
 * the refresh itself fails (e.g. refresh token expired or revoked).
 *
 * Catchers should:
 *  - Treat this as terminal — no further retries.
 *  - Optionally clear in-memory auth state and redirect to /sign-in.
 *
 * The interceptor itself does the redirect; throwing this is the signal
 * for upstream code that the session is gone.
 */
export class SessionExpiredError extends Error {
  constructor() {
    super("session_expired");
    this.name = "SessionExpiredError";
  }
}
