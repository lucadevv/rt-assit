/**
 * RecordingsApiPort — application contract for the B6 recordings
 * endpoints.
 *
 * Backend reference: python_backend/app/presentation/api/recordings_router.py
 *
 *   GET    /api/recordings                            — list user's recordings
 *   GET    /api/sessions/{id}/recording               — signed URL + TTL
 *   DELETE /api/sessions/{id}/recording               — remove recording
 *
 * Upload is owned by the live session pipeline (F2 internal — not part of
 * F8). The list endpoint is NOT tier-gated server-side; Free users simply
 * see an empty list because they cannot upload.
 *
 * Money/time conventions match the rest of the app — ISO 8601 strings
 * end-to-end, no Date in the domain.
 */

import type {
  Recording,
  RecordingWithSession,
} from "@/domain/entities/recording";

export interface SignedAudioUrl {
  url: string;
  /** Seconds until the signed URL expires (defaults to 3600). */
  expiresSeconds: number;
}

export interface RecordingsApiPort {
  /** Authenticated — list user's recordings (joined w/ session metadata). */
  list(params?: {
    limit?: number;
    offset?: number;
  }): Promise<RecordingWithSession[]>;

  /** Authenticated — fetch the signed playback URL for a single recording. */
  getSignedUrl(sessionId: string): Promise<SignedAudioUrl>;

  /** Authenticated — fetch raw metadata for a single recording. */
  get(sessionId: string): Promise<Recording>;

  /** Authenticated — owner-scoped soft delete (file + DB row). */
  delete(sessionId: string): Promise<boolean>;
}
