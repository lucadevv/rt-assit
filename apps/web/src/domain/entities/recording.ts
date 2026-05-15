/**
 * Recording domain entity — backend `RecordingResponse` mirror (B6).
 *
 * Pro+ tier feature. Each Recording is anchored to a Session via
 * `sessionId` (PK on the backend). The audio file lives in object
 * storage; the URL is fetched on-demand via a signed-URL endpoint and
 * expires after `expires_seconds` (~1h default).
 *
 * `expiresAt` (entity-level) is the auto-delete date based on the
 * user's `auto_delete_recordings_days` preference. NULL means the
 * recording is kept indefinitely (the user has explicitly disabled
 * auto-cleanup in /app/settings).
 *
 * Times are kept as ISO 8601 UTC strings — presentation parses with
 * the user locale only when rendering.
 */

export type AudioFormat =
  | "pcm"
  | "mp3"
  | "opus"
  | "webm"
  | "wav"
  | "ogg"
  | "m4a";

export interface Recording {
  sessionId: string;
  audioFormat: AudioFormat;
  audioDurationSeconds: number;
  audioSizeBytes: number;
  /** Auto-delete date (null = never expires). */
  expiresAt: string | null;
  createdAt: string;
}

/**
 * Recording joined with the parent Session metadata for the listing
 * endpoint (`GET /api/recordings`). Each row carries enough info for the
 * recordings list to render without a second round-trip per item.
 */
export interface RecordingWithSession extends Recording {
  sessionTitle: string | null;
  sessionScenario: string;
  sessionStartedAt: string;
  sessionEndedAt: string | null;
}
