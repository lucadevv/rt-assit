// Capture Service - Orchestrates audio capture from Chrome tab
// Uses state machine pattern for robust state management

import { CaptureState, CaptureConfig, AudioChunk, CaptureEvent } from '../domain/types';

type EventHandler = (event: CaptureEvent) => void;

export class CaptureService {
  private state: CaptureState = 'idle';
  private config: CaptureConfig | null = null;
  private stream: MediaStream | null = null;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private ws: WebSocket | null = null;
  private eventHandlers: EventHandler[] = [];
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 3;

  getState(): CaptureState {
    return this.state;
  }

  onEvent(handler: EventHandler): void {
    this.eventHandlers.push(handler);
  }

  private emit(event: CaptureEvent): void {
    this.eventHandlers.forEach(h => h(event));
  }

  private setState(newState: CaptureState): void {
    this.state = newState;
    this.emit({
      type: 'state_change',
      payload: newState,
      timestamp: Date.now()
    });
  }

  async start(config: CaptureConfig): Promise<void> {
    if (this.state === 'capturing' || this.state === 'starting') {
      console.warn('[CaptureService] Already capturing');
      return;
    }

    this.config = config;
    this.setState('starting');

    try {
      // Get stream from tab
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: 'tab',
            chromeMediaSourceId: config.streamId
          }
        }
      });

      // Preserve audio playback (magic 4 lines)
      this.audioContext = new AudioContext();
      const source = this.audioContext.createMediaStreamSource(this.stream);
      source.connect(this.audioContext.destination);

      // Connect WebSocket
      this.connectWebSocket();

      // Start MediaRecorder
      this.startRecorder();

      this.setState('capturing');
      this.emit({ type: 'started', timestamp: Date.now() });

    } catch (error) {
      this.setState('error');
      this.emit({
        type: 'error',
        payload: error,
        timestamp: Date.now()
      });
      throw error;
    }
  }

  private connectWebSocket(): void {
    this.ws = new WebSocket('ws://localhost:8766/audio');

    this.ws.onopen = () => {
      console.log('[CaptureService] WebSocket connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onclose = () => {
      console.log('[CaptureService] WebSocket closed');
      if (this.state === 'capturing' && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.reconnectAttempts++;
        setTimeout(() => this.connectWebSocket(), 1000);
      }
    };

    this.ws.onerror = (err) => {
      console.error('[CaptureService] WebSocket error:', err);
    };
  }

  private startRecorder(): void {
    this.mediaRecorder = new MediaRecorder(this.stream!, {
      mimeType: 'audio/webm;codecs=opus'
    });

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0 && this.ws?.readyState === WebSocket.OPEN) {
        event.data.arrayBuffer().then(buffer => {
          this.ws!.send(buffer);
          this.emit({
            type: 'chunk',
            payload: { size: buffer.byteLength } as AudioChunk,
            timestamp: Date.now()
          });
        });
      }
    };

    this.mediaRecorder.start(100); // 100ms chunks
  }

  async stop(): Promise<void> {
    if (this.state !== 'capturing') {
      return;
    }

    this.setState('stopping');

    if (this.mediaRecorder?.state === 'recording') {
      this.mediaRecorder.stop();
    }

    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }

    if (this.audioContext) {
      await this.audioContext.close();
      this.audioContext = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setState('idle');
    this.emit({ type: 'stopped', timestamp: Date.now() });
  }
}

export const captureService = new CaptureService();
