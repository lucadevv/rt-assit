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
	"time"

	"github.com/gorilla/websocket"
)

// Transcript represents a transcription result.
type Transcript struct {
	Text       string
	StartTime  time.Time
	EndTime    time.Time
	Confidence float64
	IsFinal    bool
	Speaker    int    // Speaker ID (0 = unknown, 1 = speaker 1, etc.)
	Words      []Word // Individual words with timing
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
	APIKey         string
	Model          string
	Language       string
	Encoding       string
	SampleRate     int
	Channels       int
	Punctuate      bool
	UseFlux        bool
	UtteranceEndMs int  // Silence ms to detect end of utterance (0 = disabled)
	Endpointing    int  // Endpointing in ms (0 = default 10ms, -1 = disabled)
	VADEvents      bool // Enable VAD events
}

// DefaultDeepgramConfig returns default configuration.
func DefaultDeepgramConfig() DeepgramConfig {
	return DeepgramConfig{
		Model:          "nova-2", // Default to nova-2, works with most features
		Language:       "es-419", // Spanish (Latin America)
		Punctuate:      true,
		Encoding:       "linear16",
		Channels:       1,
		SampleRate:     48000,
		UseFlux:        false,
		UtteranceEndMs: 0,     // Disabled by default - enable with DEEPGRAM_UTTERANCE_END_MS
		Endpointing:    0,     // Disabled by default - enable with DEEPGRAM_ENDPOINTING
		VADEvents:      false, // Disabled by default
	}
}

// DeepgramClient handles Deepgram streaming STT using native WebSocket.
type DeepgramClient struct {
	conn           *websocket.Conn
	ctx            context.Context
	outCh          chan<- Transcript
	utteranceEndCh chan<- struct{}
	doneCh         chan struct{}
	writeMu        sync.Mutex // Protects concurrent writes to WebSocket
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

// Start begins streaming audio to Deepgram.
func (d *DeepgramClient) Start(ctx context.Context, cfg DeepgramConfig) error {
	d.ctx = ctx
	d.doneCh = make(chan struct{})

	// Build URL query params
	query := url.Values{}
	query.Set("model", cfg.Model)
	query.Set("encoding", cfg.Encoding)
	query.Set("sample_rate", fmt.Sprintf("%d", cfg.SampleRate))
	query.Set("channels", fmt.Sprintf("%d", cfg.Channels))
	query.Set("interim_results", "true")

	if cfg.Punctuate {
		query.Set("punctuate", "true")
	}
	if cfg.Language != "" && !cfg.UseFlux {
		query.Set("language", cfg.Language)
	}

	// Utterance detection - key for conversation flow
	if cfg.UtteranceEndMs > 0 {
		query.Set("utterance_end_ms", fmt.Sprintf("%d", cfg.UtteranceEndMs))
	}

	u := url.URL{
		Scheme:   "wss",
		Host:     "api.deepgram.com",
		Path:     "/v1/listen",
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
	log.Printf("[Deepgram] ✅ WebSocket connected successfully")

	// Start keepalive to prevent timeout (send every 5 seconds)
	go d.keepAlive()

	// Start reading messages in background
	go d.readMessages()

	return nil
}

// keepAlive sends ping every 25 seconds to prevent timeout (Deepgram timeout is 30s)
func (d *DeepgramClient) keepAlive() {
	ticker := time.NewTicker(25 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			if d.conn != nil {
				d.writeMu.Lock()
				if err := d.conn.WriteJSON(map[string]interface{}{}); err != nil {
					log.Printf("[Deepgram] KeepAlive error: %v", err)
				}
				d.writeMu.Unlock()
			}
		}
	}
}

// readMessages handles incoming Deepgram messages.
func (d *DeepgramClient) readMessages() {
	for {
		if d.conn == nil {
			return
		}

		_, reader, err := d.conn.NextReader()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
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
					Text:       alt.Transcript,
					Confidence: alt.Confidence,
					IsFinal:    msg.IsFinal,
					Speaker:    speaker,
					Words:      words,
				}
				select {
				case d.outCh <- transcript:
				default:
				}

				if msg.IsFinal {
					log.Printf("[Deepgram] Transcript: %q (final=%v, speaker=%d)", alt.Transcript, msg.IsFinal, speaker)
				}
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
	if d.conn == nil {
		return fmt.Errorf("not connected")
	}

	d.writeMu.Lock()
	defer d.writeMu.Unlock()
	return d.conn.WriteMessage(websocket.BinaryMessage, audio)
}

// SendFinalize sends the finalize signal to Deepgram.
func (d *DeepgramClient) SendFinalize() error {
	if d.conn == nil {
		return fmt.Errorf("not connected")
	}

	d.writeMu.Lock()
	defer d.writeMu.Unlock()
	return d.conn.WriteJSON(map[string]bool{"finalize": true})
}

// Stop closes the Deepgram connection.
func (d *DeepgramClient) Stop() error {
	if d.conn != nil {
		close(d.doneCh)
		return d.conn.Close()
	}
	return nil
}

// IsConnected returns whether the client is connected.
func (d *DeepgramClient) IsConnected() bool {
	return d.conn != nil
}

// deepgramMessage represents a Deepgram WebSocket message.
type deepgramMessage struct {
	Type        string   `json:"type"`
	IsFinal     bool     `json:"is_final"`
	Channel     *channel `json:"channel,omitempty"`
	Description string   `json:"description,omitempty"`
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
