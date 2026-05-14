// Provider-agnostic Meeting store — owns the embedded meeting domain state for the Meeting Frame.

import { create } from "zustand";
import type { Meeting } from "@/domain/entities/meeting";
import type { Participant } from "@/domain/entities/participant";

interface MeetingStoreState {
  currentMeeting: Meeting | null;
  participants: Participant[];
  localVideoTrack: MediaStreamTrack | null;
  remoteVideoTracks: Record<string, MediaStreamTrack>;
  isMuted: boolean;
  isCameraOn: boolean;
  isScreenSharing: boolean;
}

interface MeetingStoreActions {
  setMeeting(meeting: Meeting | null): void;
  addParticipant(p: Participant): void;
  removeParticipant(participantId: string): void;
  updateParticipant(participantId: string, patch: Partial<Participant>): void;
  setLocalVideoTrack(track: MediaStreamTrack | null): void;
  setRemoteVideoTrack(participantId: string, track: MediaStreamTrack | null): void;
  setMuted(value: boolean): void;
  setCameraOn(value: boolean): void;
  setScreenSharing(value: boolean): void;
  reset(): void;
}

const INITIAL_STATE: MeetingStoreState = {
  currentMeeting: null,
  participants: [],
  localVideoTrack: null,
  remoteVideoTracks: {},
  isMuted: false,
  isCameraOn: false,
  isScreenSharing: false,
};

export const useMeetingStore = create<MeetingStoreState & MeetingStoreActions>()((set) => ({
  ...INITIAL_STATE,

  setMeeting: (meeting) => set({ currentMeeting: meeting }),

  addParticipant: (p) =>
    set((state) => {
      // Idempotent: replace existing entry by id, otherwise append.
      const idx = state.participants.findIndex((existing) => existing.id === p.id);
      if (idx === -1) {
        return { participants: [...state.participants, p] };
      }
      const next = state.participants.slice();
      next[idx] = p;
      return { participants: next };
    }),

  removeParticipant: (participantId) =>
    set((state) => {
      const nextRemote = { ...state.remoteVideoTracks };
      delete nextRemote[participantId];
      return {
        participants: state.participants.filter((p) => p.id !== participantId),
        remoteVideoTracks: nextRemote,
      };
    }),

  updateParticipant: (participantId, patch) =>
    set((state) => ({
      participants: state.participants.map((p) =>
        p.id === participantId ? { ...p, ...patch } : p,
      ),
    })),

  setLocalVideoTrack: (track) => set({ localVideoTrack: track }),

  setRemoteVideoTrack: (participantId, track) =>
    set((state) => {
      const next = { ...state.remoteVideoTracks };
      if (track === null) {
        delete next[participantId];
      } else {
        next[participantId] = track;
      }
      return { remoteVideoTracks: next };
    }),

  setMuted: (value) => set({ isMuted: value }),
  setCameraOn: (value) => set({ isCameraOn: value }),
  setScreenSharing: (value) => set({ isScreenSharing: value }),

  reset: () => set({ ...INITIAL_STATE, remoteVideoTracks: {}, participants: [] }),
}));
