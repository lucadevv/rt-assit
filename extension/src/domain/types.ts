// Domain types for audio capture
export type CaptureState = 'idle' | 'starting' | 'capturing' | 'stopping' | 'error';

export interface CaptureConfig {
  targetTabId: number;
  targetUrl: string;
  streamId?: string;
}

export interface AudioChunk {
  data: ArrayBuffer;
  timestamp: number;
  size: number;
}

export interface CaptureEvent {
  type: 'started' | 'stopped' | 'error' | 'chunk' | 'state_change';
  payload?: unknown;
  timestamp: number;
}
