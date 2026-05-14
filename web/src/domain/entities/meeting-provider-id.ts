// Identifiers for the meeting providers Auri integrates with as a frame.
export const MEETING_PROVIDER_IDS = ["meet", "zoom", "teams"] as const;
export type MeetingProviderId = (typeof MEETING_PROVIDER_IDS)[number];
