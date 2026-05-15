// Provider-agnostic meeting participant entity.
export interface Participant {
  id: string;
  displayName: string;
  isLocal: boolean;
  isMuted: boolean;
  isCameraOn: boolean;
  joinedAt: string;
}
