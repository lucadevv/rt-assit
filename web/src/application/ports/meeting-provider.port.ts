// Level-1 Strategy: a meeting provider Auri embeds (Meet, Zoom, Teams).
import type { MeetingProviderId } from "@/domain/entities/meeting-provider-id";
import type { Meeting } from "@/domain/entities/meeting";
import type { Participant } from "@/domain/entities/participant";
import type { AudioCaptureStrategy } from "./audio-capture-strategy.port";

export interface ProviderCapabilities {
  readonly supportsRawAudio: boolean;
  readonly supportsLocalVideo: boolean;
  readonly supportsScreenShare: boolean;
  readonly requiresOAuth: boolean;
}

export interface CreateMeetingOptions {
  title?: string;
  startTime?: string;
}

export type Unsubscribe = () => void;

export interface MeetingProvider {
  readonly providerId: MeetingProviderId;
  readonly capabilities: ProviderCapabilities;
  getAudioStrategy(): AudioCaptureStrategy;
  setAudioStrategy(s: AudioCaptureStrategy): void;
  createMeeting(opts: CreateMeetingOptions): Promise<Meeting>;
  joinMeeting(m: Meeting): Promise<void>;
  leaveMeeting(): Promise<void>;
  onParticipantJoin(cb: (p: Participant) => void): Unsubscribe;
  onParticipantLeave(cb: (p: Participant) => void): Unsubscribe;
}
