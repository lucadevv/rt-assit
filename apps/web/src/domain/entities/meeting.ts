// Provider-agnostic meeting entity.
import type { MeetingProviderId } from "@/domain/entities/meeting-provider-id";

export interface Meeting {
  id: string;
  providerId: MeetingProviderId;
  joinUrl: string;
  createdAt: string;
  title?: string;
}
