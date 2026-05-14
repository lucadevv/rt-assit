// Package pipeline provides audio transcription pipeline.
package pipeline

import (
	"context"
	"fmt"
	"log"
	"sync"
	"time"

	"github.com/gorilla/websocket"

	"github.com/rtassist/rt_go/internal/audioReceiver"
	"github.com/rtassist/rt_go/internal/overlay"
	"github.com/rtassist/rt_go/internal/stt"
)

// Pipeline manages the audio transcription flow.
type Pipeline struct {
	cfg         Config
	deepgramCfg stt.DeepgramConfig // Stored for lazy connect / reconnect

	// Components
	deepgram      *stt.DeepgramClient
	overlay       *overlay.Server
	audioReceiver *audioReceiver.AudioReceiver
	backendClient *websocket.Conn

	// Channels
	chunkCh        chan []byte
	transcriptCh   chan stt.Transcript
	turnResumedCh  chan struct{} // Channel for TurnResumed events
	utteranceEndCh chan struct{} // Channel for UtteranceEnd events (Fase C)

	// Deepgram lazy-connect serialization
	deepgramConnectMu sync.Mutex

	ctx    context.Context
	cancel context.CancelFunc
	wg     sync.WaitGroup
}

// audioIdleTimeout is how long the pipeline waits without receiving an audio
// chunk before closing the Deepgram session to save quota / avoid 1011 timeout.
const audioIdleTimeout = 30 * time.Second

// Config holds pipeline configuration.
type Config struct {
	OverlayPort       int
	AudioRecvPort     int
	DeepgramKey       string
	BackendURL        string
	UseFlux           bool    // Enable Flux model
	EagerEOTThreshold float64 // Eager End of Turn threshold (0.6-0.8 recommended)
}

// New creates a new Pipeline.
func New(cfg Config) *Pipeline {
	ctx, cancel := context.WithCancel(context.Background())

	chunkCh := make(chan []byte, 100)
	transcriptCh := make(chan stt.Transcript, 10)
	// Channel for turn resumed events (to cancel speculative responses)
	turnResumedCh := make(chan struct{}, 1)
	// Fase C: UtteranceEnd events from Deepgram. Buffered=1 so a single
	// pending signal is enough — coalesce_node only cares about the
	// "an utterance just ended" edge, not a queue of them.
	utteranceEndCh := make(chan struct{}, 1)

	return &Pipeline{
		cfg:            cfg,
		chunkCh:        chunkCh,
		transcriptCh:   transcriptCh,
		turnResumedCh:  turnResumedCh,
		utteranceEndCh: utteranceEndCh,
		ctx:            ctx,
		cancel:         cancel,
	}
}

// Start initializes and starts all pipeline components.
func (p *Pipeline) Start() error {
	// Initialize overlay server for WebSocket
	overlayAddr := fmt.Sprintf(":%d", p.cfg.OverlayPort)
	p.overlay = overlay.NewServer(overlayAddr)

	// Start overlay server
	go func() {
		if err := p.overlay.Start(p.ctx); err != nil {
			log.Printf("Overlay server error: %v", err)
		}
	}()

	// Connect to Python backend
	p.connectToBackend()

	// Initialize Deepgram client (connection is deferred until first audio chunk).
	// Fase C: pass the pipeline-owned utteranceEndCh so the dedicated stage
	// (startUtteranceEndStage) can forward events to the Python backend.
	p.deepgram = stt.NewDeepgramClient(p.cfg.DeepgramKey, p.transcriptCh, p.utteranceEndCh)

	// Build Deepgram config and store on pipeline for lazy connect.
	deepgramCfg := stt.DefaultDeepgramConfig()
	deepgramCfg.APIKey = p.cfg.DeepgramKey

	if p.cfg.UseFlux {
		deepgramCfg.Model = "flux-general-en"
		deepgramCfg.UseFlux = true
		log.Println("[Pipeline] Using Flux model for eager end of turn")
	}

	if p.cfg.EagerEOTThreshold > 0 {
		deepgramCfg.EagerEOTThreshold = p.cfg.EagerEOTThreshold
		deepgramCfg.EOTThreshold = 0.7
		log.Printf("[Pipeline] EagerEOT threshold: %.1f", p.cfg.EagerEOTThreshold)
	}

	p.deepgramCfg = deepgramCfg
	log.Println("[Pipeline] Deepgram configured; will connect on first audio chunk")

	// Initialize audio receiver for Chrome Extension
	audioRecvAddr := fmt.Sprintf(":%d", p.cfg.AudioRecvPort)
	p.audioReceiver = audioReceiver.NewAudioReceiver(audioRecvAddr, p.chunkCh)

	go func() {
		if err := p.audioReceiver.Start(p.ctx); err != nil {
			log.Printf("AudioReceiver error: %v", err)
		}
	}()

	// Start processing stages
	p.startVADStage()
	p.startTranscriptStage()
	p.startUtteranceEndStage()

	log.Println("Pipeline started successfully")
	log.Printf("  Overlay WebSocket: ws://localhost:%d", p.cfg.OverlayPort)
	log.Printf("  Audio from Extension: ws://localhost:%d", p.cfg.AudioRecvPort)

	return nil
}

// Stop gracefully shuts down all pipeline components.
func (p *Pipeline) Stop() {
	log.Println("Stopping pipeline...")

	p.cancel()

	if p.deepgram != nil {
		p.deepgram.Stop()
	}

	if p.overlay != nil {
		p.overlay.Stop()
	}

	p.wg.Wait()

	close(p.chunkCh)
	close(p.transcriptCh)

	log.Println("Pipeline stopped")
}

// ChunkChan returns the channel for incoming audio chunks.
func (p *Pipeline) ChunkChan() chan<- []byte {
	return p.chunkCh
}

// OverlayHub returns the overlay hub for broadcasting.
func (p *Pipeline) OverlayHub() *overlay.Hub {
	if p.overlay == nil {
		return nil
	}
	return p.overlay.Hub()
}

// connectToBackend connects to the Python backend to send transcripts.
func (p *Pipeline) connectToBackend() {
	if p.cfg.BackendURL == "" {
		return
	}

	p.wg.Add(1)
	go func() {
		defer p.wg.Done()

		reconnectDelay := 1 * time.Second
		maxReconnectDelay := 30 * time.Second

		for {
			select {
			case <-p.ctx.Done():
				return
			default:
				conn, _, err := websocket.DefaultDialer.Dial(p.cfg.BackendURL, nil)
				if err != nil {
					log.Printf("[Backend] Failed to connect: %v", err)
					log.Printf("[Backend] Reconnecting in %v...", reconnectDelay)
					time.Sleep(reconnectDelay)
					// Backoff exponencial
					reconnectDelay = reconnectDelay * 2
					if reconnectDelay > maxReconnectDelay {
						reconnectDelay = maxReconnectDelay
					}
					continue
				}

				p.backendClient = conn
				reconnectDelay = 1 * time.Second // Reset backoff on successful connect
				log.Printf("[Backend] Connected to %s", p.cfg.BackendURL)

				// Keep connection alive - wait for messages (backend doesn't send to rt_go)
				// Only reconnect on actual error
				for {
					_, _, err := conn.ReadMessage()
					if err != nil {
						log.Printf("[Backend] Connection error: %v", err)
						p.backendClient = nil
						break
					}
				}

				log.Printf("[Backend] Reconnecting...")
				time.Sleep(reconnectDelay)
			}
		}
	}()
}

// sendToBackend sends a transcript to the Python backend.
//
// F2-real-fix: forwards session_id + user_id (read from the audioReceiver's
// SessionContext, which captures them from the browser's audio WS query
// params on Upgrade) so the backend can:
//   - persist the transcript to the correct session row, and
//   - resolve the user's CV/docs in prompt_builder.
//
// Without these fields the backend falls back to LEGACY_SESSION_ID ("default"),
// docs_repo.list(user_id="default") returns nothing, and the LLM hallucinates
// a profile from the CANDIDATE_PROFILE env var. Empty IDs are OMITTED from the
// JSON envelope so backend's existing "no session_id → skip persistence" path
// still works for legacy clients.
func (p *Pipeline) sendToBackend(text string, isFinal bool, isSpeculative bool) {
	if p.backendClient == nil {
		return
	}

	msg := map[string]interface{}{
		"type":     "transcript",
		"content":  text,
		"is_final": isFinal,
	}

	// Add speculative flag if using eager end of turn
	if isSpeculative {
		msg["is_speculative"] = true
	}

	// Stamp the active session_id + user_id so the backend routes the
	// transcript to the correct tenant + session. Omit empty values so
	// backend's legacy fallback path is preserved when present.
	var sessionID, userID string
	if p.audioReceiver != nil {
		sessionID, userID = p.audioReceiver.Session().Get()
		if sessionID != "" {
			msg["session_id"] = sessionID
		}
		if userID != "" {
			msg["user_id"] = userID
		}
	}

	if err := p.backendClient.WriteJSON(msg); err != nil {
		log.Printf("[Backend] Error sending: %v", err)
		return
	}

	// Log AFTER the send so we don't claim success on errors, and include
	// a session_id prefix so we can tell at a glance whether forwarding is
	// happening (vs. the legacy "default" fallback path on the backend).
	if isSpeculative {
		sessionTag := "no-session"
		if sessionID != "" {
			sessionTag = sessionID[:min(len(sessionID), 8)]
		}
		log.Printf("[Backend] Sending speculative transcript (session=%s): %s",
			sessionTag, text[:min(len(text), 30)])
	} else if isFinal {
		sessionTag := "no-session"
		if sessionID != "" {
			sessionTag = sessionID[:min(len(sessionID), 8)]
		}
		log.Printf("[Backend] Sending final transcript (session=%s): %s",
			sessionTag, text[:min(len(text), 30)])
	}
}

// sendTurnResumed sends TurnResumed event to backend to cancel speculative response.
// Includes session_id + user_id (when known) so backend can route the cancel
// to the correct session, matching sendToBackend's envelope semantics.
func (p *Pipeline) sendTurnResumed() {
	if p.backendClient == nil {
		return
	}

	msg := map[string]interface{}{
		"type": "turn_resumed",
	}

	if p.audioReceiver != nil {
		sessionID, userID := p.audioReceiver.Session().Get()
		if sessionID != "" {
			msg["session_id"] = sessionID
		}
		if userID != "" {
			msg["user_id"] = userID
		}
	}

	if err := p.backendClient.WriteJSON(msg); err != nil {
		log.Printf("[Backend] Error sending turn_resumed: %v", err)
	}
}

// sendUtteranceEnd sends a Deepgram UtteranceEnd event to the Python backend.
//
// Fase C: this is the early-exit signal for the LangGraph coalesce_node — the
// backend matches it to the session and fires the session-state asyncio.Event
// so the coalesce_node can break out of its wall-clock sleep early.
//
// Wire format (intentionally a NEW top-level message type, NOT nested inside
// "transcript" — the contract is cleaner that way and the backend dispatch is
// a single elif branch):
//
//	{"type":"utterance_end","session_id":"...","user_id":"..."}
//
// session_id + user_id are omitted when empty so the backend can ignore stale
// signals from a pre-session warm-up connection.
func (p *Pipeline) sendUtteranceEnd() {
	if p.backendClient == nil {
		return
	}

	msg := map[string]interface{}{
		"type": "utterance_end",
	}

	var sessionID, userID string
	if p.audioReceiver != nil {
		sessionID, userID = p.audioReceiver.Session().Get()
		if sessionID != "" {
			msg["session_id"] = sessionID
		}
		if userID != "" {
			msg["user_id"] = userID
		}
	}

	if err := p.backendClient.WriteJSON(msg); err != nil {
		log.Printf("[Backend] Error sending utterance_end: %v", err)
		return
	}

	sessionTag := "no-session"
	if sessionID != "" {
		sessionTag = sessionID[:min(len(sessionID), 8)]
	}
	log.Printf("[Backend] Sent utterance_end (session=%s)", sessionTag)
}

// startVADStage processes audio chunks and sends to Deepgram.
// Connects Deepgram lazily on first chunk, closes after audioIdleTimeout of silence,
// closes IMMEDIATELY when AudioReceiver detects client disconnect (user clicked
// Stop in the browser), and attempts a single reconnect on transient send errors.
func (p *Pipeline) startVADStage() {
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()

		idleTimer := time.NewTimer(audioIdleTimeout)
		defer idleTimer.Stop()
		// Disarm initially — no chunks yet, so nothing to time out.
		if !idleTimer.Stop() {
			<-idleTimer.C
		}
		idleArmed := false

		// Subscribe to client-stop signal so we can close Deepgram the
		// moment the browser disconnects, instead of waiting for Deepgram's
		// 12s server-side 1011 timeout. Lazy reconnect on the next chunk
		// is preserved (connectDeepgram is idempotent + IsConnected gated).
		var clientStopCh <-chan struct{}
		if p.audioReceiver != nil {
			clientStopCh = p.audioReceiver.ClientStopChan()
		}

		for {
			select {
			case <-p.ctx.Done():
				return

			case <-clientStopCh:
				idleArmed = false
				if !idleTimer.Stop() {
					select {
					case <-idleTimer.C:
					default:
					}
				}
				if p.deepgram != nil && p.deepgram.IsConnected() {
					log.Println("[Pipeline] AudioReceiver client stop; closing Deepgram session immediately")
					if err := p.deepgram.Stop(); err != nil {
						log.Printf("[Pipeline] Error closing Deepgram on client stop: %v", err)
					}
				}

			case <-idleTimer.C:
				idleArmed = false
				if p.deepgram != nil && p.deepgram.IsConnected() {
					log.Printf("[Pipeline] Audio idle %v; closing Deepgram session", audioIdleTimeout)
					if err := p.deepgram.Stop(); err != nil {
						log.Printf("[Pipeline] Error closing Deepgram: %v", err)
					}
				}

			case data, ok := <-p.chunkCh:
				if !ok {
					return
				}

				if len(data) < 100 {
					continue
				}

				// Lazy connect: open Deepgram on first chunk (or after idle close).
				if !p.deepgram.IsConnected() {
					if err := p.connectDeepgram(); err != nil {
						log.Printf("[VAD] Deepgram connect failed: %v", err)
						continue
					}
				}

				if err := p.deepgram.Send(data); err != nil {
					log.Printf("[VAD] Deepgram send error: %v; attempting reconnect", err)
					if rerr := p.deepgram.Reconnect(p.ctx); rerr != nil {
						log.Printf("[VAD] Deepgram reconnect failed: %v", rerr)
					} else if rerr := p.deepgram.Send(data); rerr != nil {
						log.Printf("[VAD] Deepgram send still failing after reconnect: %v", rerr)
					}
				}

				// Reset idle timer on every accepted chunk.
				if idleArmed && !idleTimer.Stop() {
					select {
					case <-idleTimer.C:
					default:
					}
				}
				idleTimer.Reset(audioIdleTimeout)
				idleArmed = true
			}
		}
	}()
}

// connectDeepgram opens (or re-opens) the Deepgram session. Serialized so that
// concurrent goroutines do not stampede the dial.
func (p *Pipeline) connectDeepgram() error {
	p.deepgramConnectMu.Lock()
	defer p.deepgramConnectMu.Unlock()

	if p.deepgram.IsConnected() {
		return nil
	}

	log.Println("[Pipeline] First audio chunk received; connecting Deepgram...")
	return p.deepgram.Start(p.ctx, p.deepgramCfg)
}

// startUtteranceEndStage forwards Deepgram UtteranceEnd events to the Python
// backend. Runs as a dedicated goroutine so a slow backend WriteJSON cannot
// block the Deepgram reader or the transcript stage.
//
// Fase C: this is the producer side of the coalesce_node early-exit signal.
// The Deepgram client emits to p.utteranceEndCh; we relay them as a separate
// WS message type to the backend, which fires an asyncio.Event on the matching
// SessionConversationState.
func (p *Pipeline) startUtteranceEndStage() {
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()

		for {
			select {
			case <-p.ctx.Done():
				return
			case _, ok := <-p.utteranceEndCh:
				if !ok {
					return
				}
				p.sendUtteranceEnd()
			}
		}
	}()
}

// startTranscriptStage broadcasts transcripts to WebSocket clients.
func (p *Pipeline) startTranscriptStage() {
	p.wg.Add(1)
	go func() {
		defer p.wg.Done()

		for {
			select {
			case <-p.ctx.Done():
				return
			case transcript, ok := <-p.transcriptCh:
				if !ok {
					return
				}

				if transcript.Text == "" {
					continue
				}

				log.Printf("[Transcript] %q (final=%v, speculative=%v)", transcript.Text, transcript.IsFinal, transcript.IsSpeculative)

				// Broadcast to WebSocket clients (UI)
				if p.overlay != nil && p.overlay.Hub() != nil {
					p.overlay.Hub().BroadcastTranscript(transcript.Text, transcript.IsFinal, transcript.Speaker)
				}

				// Send to Python backend with full metadata
				p.sendToBackend(transcript.Text, transcript.IsFinal, transcript.IsSpeculative)
			}
		}
	}()
}
