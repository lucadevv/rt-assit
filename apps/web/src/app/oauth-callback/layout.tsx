import type { JSX, ReactNode } from "react";

/**
 * Minimal layout shim for the OAuth popup landing page.
 *
 * `/oauth-callback` is the URL the backend redirects the popup to after
 * exchanging the code. It MUST stay outside the `(app)/` route group so
 * it bypasses the Clerk auth gate (the popup may finish loading before
 * the parent's session has propagated to this tab).
 */
export default function OAuthCallbackLayout({
  children,
}: {
  children: ReactNode;
}): JSX.Element {
  return <>{children}</>;
}
