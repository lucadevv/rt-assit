// Package stt provides streaming speech-to-text via Deepgram using manual WebSocket.
package stt

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/gorilla/websocket"
)

// Transcript represents a transcription result.
type Transcript struct {
	Text          string
	StartTime     time.Time
	EndTime       time.Time
	Confidence    float64
	IsFinal       bool
	IsSpeculative bool    // True if this is an eager/end-of-turn speculative response
	Speaker       int     // Speaker ID (0 = unknown, 1 = speaker 1, etc.)
	Words         []Word  // Individual words with timing
	TurnIndex     int     // Turn index from Flux
	EndOfTurnConf float64 // Confidence that this is end of turn
}

// Word represents a single word with timing and speaker info.
type Word struct {
	Text       string  `json:"word"`
	Start      float64 `json:"start"`
	End        float64 `json:"end"`
	Speaker    int     `json:"speaker"`
	Confidence float64 `json:"confidence"`
}

// DeepgramConfig holds Deepgram client configuration.
type DeepgramConfig struct {
	APIKey            string
	Model             string
	Language          string
	Encoding          string
	SampleRate        int
	Channels          int
	Punctuate         bool
	Diarize           bool // enables speaker diarization (v1 only — not supported by Flux v2)
	UseFlux           bool
	UtteranceEndMs    int     // Silence ms to detect end of utterance (0 = disabled)
	Endpointing       int     // Endpointing in ms (0 = default 10ms, -1 = disabled)
	VADEvents         bool    // Enable VAD events
	EagerEOTThreshold float64 // Threshold for eager end of turn (0.0-1.0, 0 = disabled)
	EOTThreshold      float64 // Threshold for final end of turn (0.0-1.0)
}

// DefaultDeepgramConfig returns default configuration.
func DefaultDeepgramConfig() DeepgramConfig {
	return DeepgramConfig{
		Model:             "nova-2", // Default to nova-2, works with most features
		Language:          "es-419", // Spanish (Latin America)
		Punctuate:         true,
		Diarize:           true,
		Encoding:          "linear16",
		Channels:          1,
		SampleRate:        48000,
		UseFlux:           false,
		// Fase C: enable UtteranceEnd so Deepgram emits an explicit
		// {"type":"UtteranceEnd"} event after this many ms of silence
		// following a is_final=true transcript. We pipe it through the
		// pipeline → backend → coalesce_node as an early-exit signal.
		// Note: Deepgram requires interim_results=true AND endpointing>0
		// for UtteranceEnd to fire — both are set on the v1 path below.
		UtteranceEndMs:    1000,
		Endpointing:       10,    // 10ms (Deepgram default) — required for UtteranceEnd
		VADEvents:         false, // Disabled by default
		EagerEOTThreshold: 0.0,   // Disabled by default - enable for Flux
		EOTThreshold:      0.7,   // Default threshold for end of turn
	}
}

// DeepgramClient handles Deepgram streaming STT using native WebSocket.
type DeepgramClient struct {
	conn           *websocket.Conn
	ctx            context.Context
	cfg            DeepgramConfig
	outCh          chan<- Transcript
	utteranceEndCh chan<- struct{}
	doneCh         chan struct{}
	writeMu        sync.Mutex   // Protects concurrent writes to WebSocket
	connMu         sync.Mutex   // Protects connection lifecycle (Start/Stop/Reconnect)
	connected      atomic.Bool  // True while connection is open and usable
	closing        atomic.Bool  // True when an explicit Stop is in progress
}

// NewDeepgramClientWithUtteranceEnd creates a new Deepgram STT client with utterance end events.
func NewDeepgramClientWithUtteranceEnd(apiKey string, outCh chan<- Transcript, utteranceEndCh chan<- struct{}) *DeepgramClient {
	return &DeepgramClient{
		outCh:          outCh,
		utteranceEndCh: utteranceEndCh,
	}
}

// NewDeepgramClient creates a new Deepgram STT client.
func NewDeepgramClient(apiKey string, outCh chan<- Transcript, utteranceEndCh chan<- struct{}) *DeepgramClient {
	return &DeepgramClient{
		outCh:          outCh,
		utteranceEndCh: utteranceEndCh,
	}
}

// Start begins streaming audio to Deepgram. Idempotent: if already connected,
// it stores the new ctx/cfg only on first call and returns nil on subsequent calls.
func (d *DeepgramClient) Start(ctx context.Context, cfg DeepgramConfig) error {
	d.connMu.Lock()
	defer d.connMu.Unlock()

	if d.connected.Load() && d.conn != nil {
		return nil
	}

	d.ctx = ctx
	d.cfg = cfg
	d.closing.Store(false)
	return d.dialLocked()
}

// Reconnect closes the existing connection (if any) and reopens with the
// stored cfg. Caller must have already called Start at least once.
func (d *DeepgramClient) Reconnect(ctx context.Context) error {
	d.connMu.Lock()
	defer d.connMu.Unlock()

	if d.conn != nil {
		d.closing.Store(true)
		_ = d.conn.Close()
		d.conn = nil
		d.connected.Store(false)
	}

	if d.cfg.APIKey == "" {
		return fmt.Errorf("cannot reconnect: no stored config (Start was never called)")
	}

	d.ctx = ctx
	d.closing.Store(false)
	log.Printf("[Deepgram] Reconnecting...")
	return d.dialLocked()
}

// dialLocked opens the WebSocket and starts background goroutines.
// Caller MUST hold d.connMu.
func (d *DeepgramClient) dialLocked() error {
	cfg := d.cfg
	d.doneCh = make(chan struct{})

	// Determine endpoint based on model (Flux uses /v2/listen)
	endpointVersion := "v1"
	if cfg.UseFlux || cfg.Model == "flux-general-en" || cfg.EagerEOTThreshold > 0 {
		endpointVersion = "v2"
	}

	// Build URL query params
	query := url.Values{}
	query.Set("model", cfg.Model)
	query.Set("encoding", cfg.Encoding)
	query.Set("sample_rate", fmt.Sprintf("%d", cfg.SampleRate))

	// channels, interim_results, punctuate, language are v1-only — Flux v2 rejects them
	if !cfg.UseFlux {
		query.Set("channels", fmt.Sprintf("%d", cfg.Channels))
		query.Set("interim_results", "true")

		if cfg.Punctuate {
			query.Set("punctuate", "true")
		}
		if cfg.Diarize {
			query.Set("diarize", "true")
		}
		if cfg.Language != "" {
			query.Set("language", cfg.Language)
		}
	}

	// Utterance detection - key for conversation flow.
	// Fase C: utterance_end_ms triggers Deepgram's {"type":"UtteranceEnd"}
	// event after N ms of silence following a is_final=true transcript.
	// Requires interim_results=true AND endpointing>0 — otherwise Deepgram
	// never emits the event. Both are v1-only params (Flux v2 has its own
	// eager_eot mechanism and rejects these), so gate on !UseFlux.
	if !cfg.UseFlux {
		if cfg.UtteranceEndMs > 0 {
			query.Set("utterance_end_ms", fmt.Sprintf("%d", cfg.UtteranceEndMs))
		}
		if cfg.Endpointing > 0 {
			query.Set("endpointing", fmt.Sprintf("%d", cfg.Endpointing))
		}
	}

	// Flux-specific parameters for eager end of turn
	if cfg.EagerEOTThreshold > 0 {
		query.Set("eager_eot_threshold", fmt.Sprintf("%.1f", cfg.EagerEOTThreshold))
		log.Printf("[Deepgram] Eager EndOfTurn enabled with threshold: %.1f", cfg.EagerEOTThreshold)
	}

	if cfg.EOTThreshold > 0 && cfg.EOTThreshold < 1.0 {
		query.Set("eot_threshold", fmt.Sprintf("%.1f", cfg.EOTThreshold))
		log.Printf("[Deepgram] EndOfTurn threshold: %.1f", cfg.EOTThreshold)
	}

	u := url.URL{
		Scheme:   "wss",
		Host:     "api.deepgram.com",
		Path:     "/" + endpointVersion + "/listen",
		RawQuery: query.Encode(),
	}

	log.Printf("[Deepgram] Connecting to %s", u.String())
	log.Printf("[Deepgram] cfg.APIKey length: %d", len(cfg.APIKey))
	log.Printf("[Deepgram] cfg.APIKey value: %q", cfg.APIKey)

	apiKeyPrefix := cfg.APIKey
	if len(apiKeyPrefix) > 8 {
		apiKeyPrefix = apiKeyPrefix[:8]
	}
	log.Printf("[Deepgram] API Key prefix: %s...", apiKeyPrefix)

	headers := http.Header{}
	headers.Set("Authorization", "token "+cfg.APIKey)
	authPreview := cfg.APIKey
	if len(authPreview) > 8 {
		authPreview = authPreview[:8]
	}
	log.Printf("[Deepgram] Auth header: token %s...", authPreview)

	dialer := websocket.Dialer{
		HandshakeTimeout:  10 * time.Second,
		EnableCompression: false,
	}

	conn, resp, err := dialer.Dial(u.String(), headers)
	if err != nil {
		if resp != nil {
			body, _ := io.ReadAll(resp.Body)
			resp.Body.Close()
			log.Printf("[Deepgram] HTTP Status: %d", resp.StatusCode)
			log.Printf("[Deepgram] dg-request-id: %s", resp.Header.Get("dg-request-id"))
			log.Printf("[Deepgram] dg-error: %s", resp.Header.Get("dg-error"))
			log.Printf("[Deepgram] Response body: %s", string(body))
		}
		return fmt.Errorf("dial failed: %w", err)
	}

	d.conn = conn
	d.connected.Store(true)
	log.Printf("[Deepgram] ✅ WebSocket connected successfully")

	// Start keepalive to prevent timeout (send every 5 seconds)
	go d.keepAlive(conn)

	// Start reading messages in background
	go d.readMessages(conn)

	return nil
}

// keepAlive sends ping every 25 seconds to prevent timeout (Deepgram timeout is 30s).
// Accepts the conn explicitly so a stale goroutine (after Reconnect) can detect mismatch and exit.
func (d *DeepgramClient) keepAlive(conn *websocket.Conn) {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			return
		case <-d.doneCh:
			return
		case <-ticker.C:
			// If conn was swapped (reconnect) or cleared (stop), exit.
			if d.conn != conn {
				return
			}
			d.writeMu.Lock()
			// Flux v2 rejects app-level keepalive JSON; use WebSocket-level Ping frame instead.
			// Server will respond with Pong automatically, keeping the connection alive.
			deadline := time.Now().Add(5 * time.Second)
			err := conn.WriteControl(websocket.PingMessage, []byte{}, deadline)
			d.writeMu.Unlock()
			if err != nil {
				log.Printf("[Deepgram] Ping error: %v", err)
				d.connected.Store(false)
				return
			}
			log.Printf("[Deepgram] Ping sent")
		}
	}
}

// readMessages handles incoming Deepgram messages.
// Accepts the conn explicitly so a stale goroutine doesn't read from a swapped connection.
func (d *DeepgramClient) readMessages(conn *websocket.Conn) {
	defer func() {
		// On exit, if this is still the active conn, mark disconnected so callers reconnect lazily.
		if d.conn == conn {
			d.connected.Store(false)
		}
	}()

	for {
		if d.conn != conn {
			return
		}

		_, reader, err := conn.NextReader()
		if err != nil {
			if !d.closing.Load() && websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("[Deepgram] Read error: %v", err)
			}
			return
		}

		// Read the raw message first to check if it's empty
		rawData, err := io.ReadAll(reader)
		if err != nil {
			if !strings.Contains(err.Error(), "EOF") {
				log.Printf("[Deepgram] Read error: %v", err)
			}
			continue
		}

		// Skip empty or whitespace-only messages (keepalive responses)
		trimmed := strings.TrimSpace(string(rawData))
		if len(trimmed) == 0 {
			continue
		}

		// Decode JSON message
		var msg deepgramMessage
		if err := json.Unmarshal(rawData, &msg); err != nil {
			log.Printf("[Deepgram] Decode error: %v (raw: %s)", err, trimmed[:min(len(trimmed), 100)])
			continue
		}

		// Handle different message types
		if msg.Type == "Results" && msg.Channel != nil && len(msg.Channel.Alternatives) > 0 {
			alt := msg.Channel.Alternatives[0]
			if alt.Transcript != "" {
				// Parse words and detect dominant speaker
				words := parseWords(alt.Words)
				speaker := detectDominantSpeaker(alt.Words)

				transcript := Transcript{
					Text:          alt.Transcript,
					Confidence:    alt.Confidence,
					IsFinal:       msg.IsFinal,
					IsSpeculative: false, // Regular final transcript
					Speaker:       speaker,
					Words:         words,
					TurnIndex:     msg.TurnIndex,
					EndOfTurnConf: msg.EndOfTurnConf,
				}
				select {
				case d.outCh <- transcript:
				default:
				}

				if msg.IsFinal {
					log.Printf("[Deepgram] Final transcript: %q (turn_idx=%d, conf=%.2f)", alt.Transcript, msg.TurnIndex, msg.EndOfTurnConf)
				}
			}
		} else if msg.Type == "EagerEndOfTurn" && msg.Channel != nil && len(msg.Channel.Alternatives) > 0 {
			// Eager end of turn - speculative response while user is still speaking
			alt := msg.Channel.Alternatives[0]
			if alt.Transcript != "" {
				words := parseWords(alt.Words)
				speaker := detectDominantSpeaker(alt.Words)

				transcript := Transcript{
					Text:          alt.Transcript,
					Confidence:    alt.Confidence,
					IsFinal:       false,
					IsSpeculative: true, // This is a speculative response
					Speaker:       speaker,
					Words:         words,
					TurnIndex:     msg.TurnIndex,
					EndOfTurnConf: msg.EndOfTurnConf,
				}
				select {
				case d.outCh <- transcript:
				default:
				}
				log.Printf("[Deepgram] ⚡ EagerEndOfTurn: %q (conf=%.2f)", alt.Transcript, msg.EndOfTurnConf)
			}
		} else if msg.Type == "TurnResumed" {
			// User continued speaking - this cancels the speculative response
			log.Printf("[Deepgram] 🔄 Turn resumed - cancelling speculative response")
			select {
			case d.utteranceEndCh <- struct{}{}:
			default:
			}
		} else if msg.Type == "SpeechStarted" {
			log.Printf("[Deepgram] Speech started")
		} else if msg.Type == "UtteranceEnd" {
			log.Printf("[Deepgram] Utterance end")
			select {
			case d.utteranceEndCh <- struct{}{}:
			default:
			}
		} else if msg.Type == "Error" && msg.Description != "" {
			log.Printf("[Deepgram] Error: %s", msg.Description)
		} else if msg.Type == "" && msg.Channel == nil {
			// Might be a KeepAlive or metadata message
		}
	}
}

// Send sends audio data to Deepgram for transcription.
func (d *DeepgramClient) Send(audio []byte) error {
	if !d.connected.Load() || d.conn == nil {
		return fmt.Errorf("not connected")
	}

	d.writeMu.Lock()
	defer d.writeMu.Unlock()
	err := d.conn.WriteMessage(websocket.BinaryMessage, audio)
	if err != nil {
		d.connected.Store(false)
	}
	return err
}

// SendFinalize sends the finalize signal to Deepgram.
func (d *DeepgramClient) SendFinalize() error {
	if !d.connected.Load() || d.conn == nil {
		return fmt.Errorf("not connected")
	}

	d.writeMu.Lock()
	defer d.writeMu.Unlock()
	return d.conn.WriteJSON(map[string]bool{"finalize": true})
}

// Stop closes the Deepgram connection. Idempotent.
func (d *DeepgramClient) Stop() error {
	d.connMu.Lock()
	defer d.connMu.Unlock()

	if d.conn == nil {
		return nil
	}

	d.closing.Store(true)
	d.connected.Store(false)
	if d.doneCh != nil {
		select {
		case <-d.doneCh:
		default:
			close(d.doneCh)
		}
	}
	err := d.conn.Close()
	d.conn = nil
	log.Printf("[Deepgram] WebSocket closed")
	return err
}

// IsConnected returns whether the client has an active, usable WebSocket.
func (d *DeepgramClient) IsConnected() bool {
	return d.connected.Load() && d.conn != nil && !d.closing.Load()
}

// deepgramMessage represents a Deepgram WebSocket message.
type deepgramMessage struct {
	Type          string   `json:"type"`
	IsFinal       bool     `json:"is_final"`
	Channel       *channel `json:"channel,omitempty"`
	Description   string   `json:"description,omitempty"`
	TurnIndex     int      `json:"turn_index,omitempty"`
	EndOfTurnConf float64  `json:"end_of_turn_confidence,omitempty"`
}

// channel represents the transcription channel data.
type channel struct {
	Alternatives []alternative `json:"alternatives"`
}

// alternative represents a transcription alternative.
type alternative struct {
	Transcript string  `json:"transcript"`
	Confidence float64 `json:"confidence"`
	Words      []word  `json:"words,omitempty"`
}

// word represents a single word from Deepgram.
type word struct {
	Word       string  `json:"word"`
	Start      float64 `json:"start"`
	End        float64 `json:"end"`
	Confidence float64 `json:"confidence"`
	Speaker    int     `json:"speaker"`
}

// parseWords converts Deepgram word format to our Word format.
func parseWords(words []word) []Word {
	if len(words) == 0 {
		return nil
	}

	result := make([]Word, len(words))
	for i, w := range words {
		result[i] = Word{
			Text:       w.Word,
			Start:      w.Start,
			End:        w.End,
			Speaker:    w.Speaker,
			Confidence: w.Confidence,
		}
	}
	return result
}

// detectDominantSpeaker finds the most common speaker in the words.
func detectDominantSpeaker(words []word) int {
	if len(words) == 0 {
		return 0
	}

	speakerCounts := make(map[int]int)
	for _, w := range words {
		if w.Speaker >= 0 {
			speakerCounts[w.Speaker]++
		}
	}

	// Find speaker with most words
	maxCount := 0
	dominantSpeaker := 0
	for speaker, count := range speakerCounts {
		if count > maxCount {
			maxCount = count
			dominantSpeaker = speaker
		}
	}

	return dominantSpeaker
}
