/**
 * SessionsApiAdapter — `SessionsApiPort` implementation using ApiClient.
 *
 * snake_case ↔ camelCase mapping happens here so the application layer
 * stays clean. All ISO timestamps from the backend are kept as strings.
 */

import type { ApiClient } from "@/application/ports/api-client.port";
import type {
  CreateSessionInput,
  SessionDetail,
  SessionsApiPort,
} from "@/application/ports/sessions-api.port";
import type { Session, SessionMode, SessionStatus } from "@/domain/entities/session";
import type { Transcript } from "@/domain/entities/transcript";
import type { Hint } from "@/domain/entities/hint";
import type { Speaker } from "@/domain/entities/speaker";
import type { ScenarioColor } from "@/domain/entities/scenario";

interface SessionResponseRaw {
  id: string;
  user_id: string;
  scenario: string;
  title: string | null;
  my_language: string;
  other_language: string;
  started_at: string;
  ended_at: string | null;
  duration_seconds: number | null;
  is_recording: boolean;
  summary: string | null;
  action_items: string[];
  metadata: Record<string, unknown>;
  status: string;
  /**
   * Optional in the raw payload because old session rows (created before
   * I1 shipped the field on the backend) won't surface a `mode`. We
   * default to "agent" at mapping time so the domain entity stays
   * non-nullable.
   */
  mode?: string | null;
}

interface TranscriptResponseRaw {
  id: number;
  session_id: string;
  speaker_id: number | null;
  deepgram_speaker: number | null;
  content: string;
  is_final: boolean;
  timestamp_ms: number;
  language: string | null;
  confidence: number | null;
}

interface HintResponseRaw {
  id: number;
  session_id: string;
  related_transcript_id: number | null;
  content: string;
  timestamp_ms: number;
}

interface SpeakerResponseRaw {
  id: number;
  session_id: string;
  deepgram_speaker_id: number;
  label: string | null;
  is_user: boolean;
  color_hint: string;
}

interface SessionDetailResponseRaw {
  session: SessionResponseRaw;
  transcripts: TranscriptResponseRaw[];
  hints: HintResponseRaw[];
  speakers: SpeakerResponseRaw[];
  tags: string[];
}

const VALID_STATUS: readonly SessionStatus[] = ["active", "ended", "abandoned"];

function normaliseStatus(raw: string): SessionStatus {
  return (VALID_STATUS as readonly string[]).includes(raw)
    ? (raw as SessionStatus)
    : "active";
}

const VALID_MODES: readonly SessionMode[] = ["agent", "scribe"];

/**
 * Coerce the raw `mode` value (which may be `undefined` / `null` /
 * unexpected string for old rows) into a valid SessionMode. Default is
 * "agent" — that's the pre-mode behaviour and the safe fallback.
 */
function normaliseMode(raw: string | null | undefined): SessionMode {
  if (raw && (VALID_MODES as readonly string[]).includes(raw)) {
    return raw as SessionMode;
  }
  return "agent";
}

function normaliseColor(raw: string): ScenarioColor {
  if (raw === "cyan" || raw === "amber" || raw === "lavender" || raw === "lime") {
    return raw;
  }
  return "lime";
}

function mapSession(raw: SessionResponseRaw): Session {
  return {
    id: raw.id,
    userId: raw.user_id,
    scenario: raw.scenario,
    title: raw.title,
    myLanguage: raw.my_language,
    otherLanguage: raw.other_language,
    startedAt: raw.started_at,
    endedAt: raw.ended_at,
    durationSeconds: raw.duration_seconds,
    isRecording: raw.is_recording,
    summary: raw.summary,
    actionItems: [...raw.action_items],
    status: normaliseStatus(raw.status),
    mode: normaliseMode(raw.mode),
  };
}

function mapTranscript(raw: TranscriptResponseRaw): Transcript {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    speakerId: raw.speaker_id,
    deepgramSpeaker: raw.deepgram_speaker,
    content: raw.content,
    isFinal: raw.is_final,
    timestampMs: raw.timestamp_ms,
    language: raw.language,
    confidence: raw.confidence,
  };
}

function mapHint(raw: HintResponseRaw): Hint {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    relatedTranscriptId: raw.related_transcript_id,
    content: raw.content,
    timestampMs: raw.timestamp_ms,
  };
}

export function mapSpeaker(raw: SpeakerResponseRaw): Speaker {
  return {
    id: raw.id,
    sessionId: raw.session_id,
    deepgramSpeakerId: raw.deepgram_speaker_id,
    label: raw.label,
    isUser: raw.is_user,
    colorHint: normaliseColor(raw.color_hint),
  };
}

export class SessionsApiAdapter implements SessionsApiPort {
  constructor(private readonly api: ApiClient) {}

  async create(input: CreateSessionInput): Promise<Session> {
    const body: Record<string, unknown> = {
      scenario: input.scenario,
      my_language: input.myLanguage,
      other_language: input.otherLanguage,
      is_recording: input.isRecording,
    };
    if (input.title !== undefined) body["title"] = input.title;
    // `mode` is a single word so camel → snake is identity. Old backends
    // (pre-I1) silently ignore unknown body keys, so it's safe to ship.
    if (input.mode !== undefined) body["mode"] = input.mode;
    // Merge documentIds into metadata so we ship a single bag — backend
    // ignores unknown keys, but a future endpoint update can pick them up
    // without an additional REST contract.
    const meta: Record<string, unknown> = { ...(input.metadata ?? {}) };
    if (input.documentIds && input.documentIds.length > 0) {
      meta["document_ids"] = [...input.documentIds];
    }
    if (Object.keys(meta).length > 0) {
      body["metadata"] = meta;
    }
    const raw = await this.api.post<SessionResponseRaw>("/api/sessions", body);
    return mapSession(raw);
  }

  async list(params?: {
    scenario?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Session[]> {
    const qs = new URLSearchParams();
    if (params?.scenario) qs.set("scenario", params.scenario);
    if (params?.search) qs.set("search", params.search);
    if (params?.limit != null) qs.set("limit", String(params.limit));
    if (params?.offset != null) qs.set("offset", String(params.offset));
    const path =
      qs.toString().length > 0 ? `/api/sessions?${qs.toString()}` : "/api/sessions";
    const raw = await this.api.get<SessionResponseRaw[]>(path);
    return raw.map(mapSession);
  }

  async active(): Promise<Session | null> {
    const raw = await this.api.get<SessionResponseRaw | null>(
      "/api/sessions/active",
    );
    if (!raw) return null;
    return mapSession(raw);
  }

  async detail(sessionId: string): Promise<SessionDetail> {
    const raw = await this.api.get<SessionDetailResponseRaw>(
      `/api/sessions/${encodeURIComponent(sessionId)}`,
    );
    return {
      session: mapSession(raw.session),
      transcripts: raw.transcripts.map(mapTranscript),
      hints: raw.hints.map(mapHint),
      speakers: raw.speakers.map(mapSpeaker),
      tags: [...raw.tags],
    };
  }

  async end(sessionId: string): Promise<Session> {
    const raw = await this.api.post<SessionResponseRaw>(
      `/api/sessions/${encodeURIComponent(sessionId)}/end`,
    );
    return mapSession(raw);
  }

  async regenerateSummary(sessionId: string): Promise<Session> {
    const raw = await this.api.post<SessionResponseRaw>(
      `/api/sessions/${encodeURIComponent(sessionId)}/regenerate-summary`,
    );
    return mapSession(raw);
  }

  async delete(sessionId: string): Promise<boolean> {
    const raw = await this.api.delete<{ deleted: boolean }>(
      `/api/sessions/${encodeURIComponent(sessionId)}`,
    );
    return raw.deleted === true;
  }
}
