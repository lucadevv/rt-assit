/**
 * Transcript domain entity — backend `TranscriptResponse` mirror.
 *
 * Two flavours coexist in the live UI:
 *   - server-confirmed transcripts (`id` numeric, persisted by B1) returned
 *     by GET /api/sessions/{id}.
 *   - in-flight transcripts coming from the rt_go overlay WS BEFORE the
 *     backend has assigned an id (interim deepgram results). Those have
 *     `id === undefined` and are stored as the `interim` slot in the
 *     session store; once a `is_final` arrives they're committed to the
 *     finals array (the server-side persistence happens in parallel via
 *     the backend WS broadcast — when the persisted row arrives we just
 *     reconcile by matching deepgramSpeaker + content).
 *
 * `speakerId` (backend Speaker.id) is null until the backend persists it;
 * `deepgramSpeaker` is the raw 0/1/2... cluster id which the live UI uses
 * for grouping and color resolution before any persistence has happened.
 */

export interface Transcript {
  id?: number;
  sessionId: string;
  speakerId: number | null;
  deepgramSpeaker: number | null;
  content: string;
  isFinal: boolean;
  timestampMs: number;
  language: string | null;
  confidence: number | null;
}
