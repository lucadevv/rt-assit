/**
 * Usage domain entity — TypeScript mirror of the backend `UsageRecord`
 * entity.
 *
 * Backend contract (GET /api/billing/usage as `UsageResponse`):
 *
 *   {
 *     user_id: string,
 *     period_start: string,            // ISO 8601 UTC
 *     period_end: string,
 *     minutes_used: integer,
 *     sessions_count: integer,
 *     sessions_completed: integer,
 *     docs_count: integer,
 *     storage_bytes_used: integer,
 *     share_links_created: integer,
 *     llm_input_tokens: integer,
 *     llm_output_tokens: integer,
 *     stt_audio_seconds: integer,
 *     cost_cents: integer,
 *     limit_hits: Record<string, unknown>
 *   }
 *
 * Frontend exposes camelCase. `period_start`/`period_end` define the
 * billing/usage window (typically the calendar month for paid plans).
 */

export interface Usage {
  userId: string;
  periodStart: string;
  periodEnd: string;
  minutesUsed: number;
  sessionsCount: number;
  sessionsCompleted: number;
  docsCount: number;
  storageBytesUsed: number;
  shareLinksCreated: number;
  llmInputTokens: number;
  llmOutputTokens: number;
  sttAudioSeconds: number;
  costCents: number;
  limitHits: Record<string, unknown>;
}
