/**
 * FetchApiClient — concrete `ApiClient` adapter using the Fetch API.
 *
 * Responsibilities:
 *   - Prepend the API base URL.
 *   - Forward cookies (credentials: "include") — Fase D cookie-based auth
 *     is the primary credential for the web frontend.
 *   - Forward Bearer JWT only when `getToken` is provided (currently only
 *     clerk mode uses this; cookie-mode omits it).
 *   - Single-flight 401 → /api/auth/refresh → retry interceptor.
 *   - JSON serialize/deserialize.
 *   - Surface non-2xx responses as Error with status + body.
 *
 * The base URL is read from a config object instead of `process.env` so the
 * composition root (infrastructure/di/container.ts) controls instantiation
 * and unit tests can inject any URL they like.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import { NetworkError } from "./network.error";
import { SessionExpiredError } from "./session-expired.error";

type RefreshOutcome = "success" | "expired" | "network_error";

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
  /**
   * Called when the interceptor's refresh attempt itself fails. The
   * caller (DI composition root) should clear auth state + redirect
   * to /sign-in. Optional — falls back to throwing SessionExpiredError.
   */
  onSessionExpired?: () => void;
}

export class FetchApiClient implements ApiClient {
  /**
   * Single inflight refresh promise. Multiple concurrent 401s share ONE
   * /api/auth/refresh call (avoids thundering herd + maintains rotation
   * invariant — only one new refresh token is issued).
   *
   * Outcome is tri-state so the caller can distinguish "server says
   * session is gone" (expired) from "we can't talk to the server at all"
   * (network_error) — the UX differs.
   */
  private refreshInflight: Promise<RefreshOutcome> | null = null;

  constructor(private readonly config: ApiClientConfig) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    // Cookies handle auth automatically via `credentials: "include"` in
    // every request. `getToken` remains optional for the clerk adapter,
    // which still uses Bearer internally. Custom + dev modes do NOT
    // provide getToken — cookies are the only credential.
    if (this.config.getToken) {
      try {
        const token = await this.config.getToken();
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
      } catch {
        // If token retrieval fails (e.g. session expired), let the request
        // proceed without auth — backend will reject with 401 and the
        // route guard will surface the auth flow.
      }
    }
    return headers;
  }

  /**
   * Attempt to refresh the session. Subsequent concurrent callers receive
   * the SAME promise so we never fire parallel /refresh calls.
   *
   * Returns one of:
   *   "success"        — refresh OK, caller should retry the original request
   *   "expired"        — server returned non-2xx (refresh token rejected)
   *   "network_error"  — fetch threw (offline / DNS / CORS); session may
   *                      still be valid, we just can't prove it right now
   *
   * The new access cookie is set server-side via Set-Cookie on success.
   * The browser applies it automatically before the retried request fires.
   */
  private async tryRefresh(): Promise<RefreshOutcome> {
    if (this.refreshInflight) {
      return this.refreshInflight;
    }
    this.refreshInflight = (async (): Promise<RefreshOutcome> => {
      try {
        const res = await fetch(`${this.config.baseUrl}/api/auth/refresh`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
        });
        return res.ok ? "success" : "expired";
      } catch {
        // fetch only throws on transport failures — DNS, offline, CORS
        // preflight rejection, etc. Server-side rejections (incl. 401)
        // resolve normally with res.ok === false, handled above.
        return "network_error";
      } finally {
        // Clear AFTER current awaiters resolve so they all see the same
        // result. Future 401s (much later, e.g. user idle) can refresh again.
        queueMicrotask(() => {
          this.refreshInflight = null;
        });
      }
    })();
    return this.refreshInflight;
  }

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;

    const send = async (): Promise<Response> => {
      const auth = await this.authHeaders();
      const headers: Record<string, string> = { ...auth };
      if (init.headers) {
        // Merge caller-provided headers (rare). Object.entries handles plain
        // objects; HeadersInit can also be Headers or [k,v][] but our use
        // cases only pass object literals.
        Object.assign(headers, init.headers as Record<string, string>);
      }
      return fetch(url, { ...init, credentials: "include", headers });
    };

    let res = await send();

    // 401 interceptor — single retry after refresh. Skip self-targeted auth
    // routes to avoid infinite loops (e.g. /refresh returning 401 must NOT
    // trigger another /refresh).
    if (res.status === 401 && !path.startsWith("/api/auth/")) {
      const outcome = await this.tryRefresh();
      if (outcome === "success") {
        res = await send();
      } else if (outcome === "expired") {
        this.config.onSessionExpired?.();
        throw new SessionExpiredError();
      } else {
        // network_error — don't hard-nav; keep the existing session UI
        // mounted so the user can retry when connectivity returns.
        throw new NetworkError("Failed to reach auth server");
      }
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`API ${res.status} ${path}: ${text}`);
    }
    // 204 No Content → return undefined cast to T.
    if (res.status === 204) {
      return undefined as unknown as T;
    }
    return (await res.json()) as T;
  }

  get<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "GET" });
  }

  post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  patch<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>(path, {
      method: "PATCH",
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  }

  delete<T>(path: string): Promise<T> {
    return this.request<T>(path, { method: "DELETE" });
  }
}
