/**
 * ApiClient port — minimal HTTP surface used by use cases.
 *
 * Use cases depend on this interface (not on `fetch` directly), so they
 * remain trivially mockable for unit tests. The concrete adapter
 * (`infrastructure/http/api-client.ts`) handles auth headers, base URL,
 * JSON serialisation, and error mapping.
 *
 * The shape is intentionally narrow (4 verbs, generic body) — anything
 * fancier (pagination, retries) belongs to specific use cases or
 * specialised adapters, not the generic port.
 */

export interface ApiClient {
  get<T>(path: string): Promise<T>;
  post<T>(path: string, body?: unknown): Promise<T>;
  patch<T>(path: string, body?: unknown): Promise<T>;
  delete<T>(path: string): Promise<T>;
}
