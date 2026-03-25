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
}

// DeepgramConfig holds Deepgram client configuration.
type DeepgramConfig struct {
	APIKey     string
	Model      string
	Language   string
	Encoding   string
	SampleRate int
	Channels   int
	Punctuate  bool
	UseFlux    bool
}

// DefaultDeepgramConfig returns default configuration.
func DefaultDeepgramConfig() DeepgramConfig {
	return DeepgramConfig{
		Model:      "nova-2",
		Language:   "es-419", // Spanish (Latin America)
		Punctuate:  true,
		Encoding:   "linear16",
		Channels:   1,
		SampleRate: 48000,
		UseFlux:    false,
	}
}

// DeepgramClient handles Deepgram streaming STT using native WebSocket.
type DeepgramClient struct {
	conn   *websocket.Conn
	ctx    context.Context
	outCh  chan<- Transcript
	doneCh chan struct{}
}

// NewDeepgramClient creates a new Deepgram STT client.
func NewDeepgramClient(apiKey string, outCh chan<- Transcript) *DeepgramClient {
	return &DeepgramClient{
		outCh: outCh,
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

// keepAlive sends newline every 5 seconds to prevent timeout
func (d *DeepgramClient) keepAlive() {
	ticker := time.NewTicker(5 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-d.ctx.Done():
			return
		case <-ticker.C:
			if d.conn != nil {
				// Send newline which is valid JSON
				if err := d.conn.WriteMessage(websocket.TextMessage, []byte("\n")); err != nil {
					log.Printf("[Deepgram] KeepAlive error: %v", err)
				}
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

		// Decode JSON message
		var msg deepgramMessage
		if err := json.NewDecoder(reader).Decode(&msg); err != nil {
			// Ignore EOF errors from keepalive messages
			if !strings.Contains(err.Error(), "EOF") {
				log.Printf("[Deepgram] Decode error: %v", err)
			}
			continue
		}

		// Handle different message types
		if msg.Type == "Results" && msg.Channel != nil && len(msg.Channel.Alternatives) > 0 {
			alt := msg.Channel.Alternatives[0]
			if alt.Transcript != "" {
				transcript := Transcript{
					Text:       alt.Transcript,
					Confidence: alt.Confidence,
					IsFinal:    msg.IsFinal,
				}
				select {
				case d.outCh <- transcript:
				default:
				}
				log.Printf("[Deepgram] Transcript: %q (final=%v)", alt.Transcript, msg.IsFinal)
			}
		} else if msg.Type == "SpeechStarted" {
			log.Printf("[Deepgram] Speech started")
		} else if msg.Type == "UtteranceEnd" {
			log.Printf("[Deepgram] Utterance end")
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
	return d.conn.WriteMessage(websocket.BinaryMessage, audio)
}

// SendFinalize sends the finalize signal to Deepgram.
func (d *DeepgramClient) SendFinalize() error {
	if d.conn == nil {
		return fmt.Errorf("not connected")
	}
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
}
