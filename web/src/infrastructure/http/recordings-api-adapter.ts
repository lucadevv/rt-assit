/**
 * RecordingsApiAdapter — concrete `RecordingsApiPort` impl.
 *
 * Backend reference: python_backend/app/presentation/api/recordings_router.py
 *
 * Mapping conventions:
 *   - snake_case backend → camelCase domain at this boundary.
 *   - audio_format normalised to a known AudioFormat union (defensive
 *     fallback to "webm" when the backend returns an unknown value —
 *     prevents leaking string literals into the domain).
 *   - ISO 8601 timestamps remain as strings (Date conversions happen at
 *     the presentation boundary only).
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  RecordingsApiPort,
  SignedAudioUrl,
} from "@/application/ports/recordings-api.port";
import type {
  AudioFormat,
  Recording,
  RecordingWithSession,
} from "@/domain/entities/recording";

interface RecordingResponseRaw {
  session_id: string;
  audio_format: string;
  audio_duration_seconds: number;
  audio_size_bytes: number;
  expires_at: string | null;
  created_at: string;
}

interface RecordingListItemRaw extends RecordingResponseRaw {
  session_title: string | null;
  scenario: string;
  started_at: string;
  ended_at: string | null;
}

interface SignedUrlRaw {
  url: string;
  expires_seconds: number;
}

const KNOWN_FORMATS: readonly AudioFormat[] = [
  "pcm",
  "mp3",
  "opus",
  "webm",
  "wav",
  "ogg",
  "m4a",
];

function asAudioFormat(raw: string): AudioFormat {
  const lower = raw.toLowerCase().trim() as AudioFormat;
  return (KNOWN_FORMATS as readonly string[]).includes(lower) ? lower : "webm";
}

function mapRecording(raw: RecordingResponseRaw): Recording {
  return {
    sessionId: raw.session_id,
    audioFormat: asAudioFormat(raw.audio_format),
    audioDurationSeconds: raw.audio_duration_seconds,
    audioSizeBytes: raw.audio_size_bytes,
    expiresAt: raw.expires_at,
    createdAt: raw.created_at,
  };
}

function mapListItem(raw: RecordingListItemRaw): RecordingWithSession {
  return {
    ...mapRecording(raw),
    sessionTitle: raw.session_title,
    sessionScenario: raw.scenario,
    sessionStartedAt: raw.started_at,
    sessionEndedAt: raw.ended_at,
  };
}

export class RecordingsApiAdapter implements RecordingsApiPort {
  constructor(private readonly api: ApiClient) {}

  async list(params?: {
    limit?: number;
    offset?: number;
  }): Promise<RecordingWithSession[]> {
    const qs = new URLSearchParams();
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const path =
      qs.toString().length > 0
        ? `/api/recordings?${qs.toString()}`
        : "/api/recordings";
    const raw = await this.api.get<RecordingListItemRaw[]>(path);
    return raw.map(mapListItem);
  }

  async getSignedUrl(sessionId: string): Promise<SignedAudioUrl> {
    const raw = await this.api.get<SignedUrlRaw>(
      `/api/sessions/${encodeURIComponent(sessionId)}/recording`,
    );
    return {
      url: raw.url,
      expiresSeconds: raw.expires_seconds,
    };
  }

  async get(sessionId: string): Promise<Recording> {
    // The dedicated metadata endpoint and the signed-URL endpoint share
    // the same path; the GET there returns `{url, expires_seconds}` only.
    // Real metadata lives in the listing — we synthesise from a focused
    // list call. In practice F8 calls list() once and uses cached items.
    const items = await this.list({ limit: 100, offset: 0 });
    const found = items.find((r) => r.sessionId === sessionId);
    if (!found) {
      throw new Error(
        `No se encontró la grabación para la sesión ${sessionId}.`,
      );
    }
    // Strip the session-side fields to return a plain Recording.
    return {
      sessionId: found.sessionId,
      audioFormat: found.audioFormat,
      audioDurationSeconds: found.audioDurationSeconds,
      audioSizeBytes: found.audioSizeBytes,
      expiresAt: found.expiresAt,
      createdAt: found.createdAt,
    };
  }

  async delete(sessionId: string): Promise<boolean> {
    const raw = await this.api.delete<{ deleted: boolean }>(
      `/api/sessions/${encodeURIComponent(sessionId)}/recording`,
    );
    return raw.deleted === true;
  }
}
