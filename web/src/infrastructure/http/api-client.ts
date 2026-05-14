/**
 * FetchApiClient — concrete `ApiClient` adapter using the Fetch API.
 *
 * Responsibilities:
 *   - Prepend the API base URL.
 *   - Forward Bearer JWT (when `getToken` is provided by the auth port).
 *   - JSON serialize/deserialize.
 *   - Surface non-2xx responses as Error with status + body.
 *
 * The base URL is read from a config object instead of `process.env` so the
 * composition root (infrastructure/di/container.ts) controls instantiation
 * and unit tests can inject any URL they like.
 */

import type { ApiClient } from "@/application/ports/api-client.port";

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
}

export class FetchApiClient implements ApiClient {
  constructor(private readonly config: ApiClientConfig) {}

  private async authHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
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

  private async request<T>(path: string, init: RequestInit): Promise<T> {
    const url = `${this.config.baseUrl}${path}`;
    const auth = await this.authHeaders();
    const headers: Record<string, string> = { ...auth };
    if (init.headers) {
      // Merge caller-provided headers (rare). Object.entries handles plain
      // objects; HeadersInit can also be Headers or [k,v][] but our use
      // cases only pass object literals.
      Object.assign(headers, init.headers as Record<string, string>);
    }
    const res = await fetch(url, { ...init, headers });
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
