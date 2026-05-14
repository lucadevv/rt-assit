// Package audioReceiver receives audio from the Chrome extension via WebSocket.
package audioReceiver

import (
	"context"
	"fmt"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

// SessionContext carries the session_id + user_id of the currently active
// browser audio WebSocket connection. handleAudio() Set()s it on Upgrade
// from query params; the pipeline's sendToBackend() reads it via Get() to
// stamp transcripts with the correct multi-tenant routing. Mutex-protected
// because Upgrade and pipeline goroutines run independently.
//
// Single-active-session invariant: B1's interim model assumes ONE active
// audio session per rt_go instance at a time (one mic per user). When
// multi-session arrives this should become per-connection, not singleton.
type SessionContext struct {
	mu        sync.RWMutex
	sessionID string
	userID    string
}

// Set stores the session_id + user_id of the currently active connection.
func (s *SessionContext) Set(sessionID, userID string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessionID = sessionID
	s.userID = userID
}

// Get returns the currently active session_id + user_id (may be empty).
func (s *SessionContext) Get() (string, string) {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.sessionID, s.userID
}

// Clear resets the session context so stale IDs don't leak into the next
// connection after a disconnect.
func (s *SessionContext) Clear() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.sessionID = ""
	s.userID = ""
}

// AudioReceiver receives raw PCM audio from Chrome extension.
type AudioReceiver struct {
	addr           string
	outCh          chan []byte
	clientStop     chan struct{}
	server         *http.Server
	sessionContext *SessionContext
}

// NewAudioReceiver creates a new audio receiver listening on the given address.
func NewAudioReceiver(addr string, outCh chan []byte) *AudioReceiver {
	return &AudioReceiver{
		addr:           addr,
		outCh:          outCh,
		clientStop:     make(chan struct{}, 1),
		sessionContext: &SessionContext{},
	}
}

// Session returns the SessionContext holding the currently active
// session_id + user_id. The pipeline reads from this when forwarding
// transcripts to the backend.
func (r *AudioReceiver) Session() *SessionContext {
	return r.sessionContext
}

// ClientStopChan returns a channel that fires (best-effort, non-blocking) when
// the browser extension's WebSocket disconnects — i.e. the user pressed Stop.
// The pipeline subscribes to this to close Deepgram immediately, instead of
// waiting for Deepgram's 12s server-side timeout (1011) or our 30s idle timer.
func (r *AudioReceiver) ClientStopChan() <-chan struct{} {
	return r.clientStop
}

// Start begins listening for audio connections from the Chrome extension.
func (r *AudioReceiver) Start(ctx context.Context) error {
	mux := http.NewServeMux()
	mux.HandleFunc("/audio", r.handleAudio)

	r.server = &http.Server{
		Addr:    r.addr,
		Handler: mux,
	}

	errCh := make(chan error, 1)
	go func() {
		log.Printf("[AudioReceiver] Listening on %s", r.addr)
		if err := r.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("audio receiver error: %w", err)
	case <-ctx.Done():
		return r.server.Shutdown(context.Background())
	}
}

// Stop gracefully shuts down the receiver.
func (r *AudioReceiver) Stop() error {
	if r.server != nil {
		return r.server.Shutdown(context.Background())
	}
	return nil
}

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for localhost
	},
}

func (r *AudioReceiver) handleAudio(w http.ResponseWriter, req *http.Request) {
	// Read session_id + user_id from query params BEFORE Upgrade so the
	// pipeline can stamp every transcript chunk for multi-tenant routing.
	// Without these, the backend falls back to LEGACY_SESSION_ID ("default")
	// → prompt_builder can't find the user's CV → LLM hallucinates.
	sessionID := req.URL.Query().Get("session_id")
	userID := req.URL.Query().Get("user_id")

	conn, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		log.Printf("[AudioReceiver] Upgrade error: %v", err)
		return
	}
	defer conn.Close()
	// Always signal client stop on disconnect so the pipeline can close
	// Deepgram immediately. Non-blocking send: if a previous stop signal
	// hasn't been consumed yet, we drop this one (idempotent).
	defer func() {
		select {
		case r.clientStop <- struct{}{}:
		default:
		}
	}()

	// Stamp the active session for the pipeline to read on every send.
	// Cleared on disconnect so stale IDs don't leak into the next session.
	if sessionID != "" || userID != "" {
		r.sessionContext.Set(sessionID, userID)
		log.Printf("[AudioReceiver] Connected: session_id=%s user_id=%s", sessionID, userID)
	} else {
		log.Printf("[AudioReceiver] Connected: NO session_id/user_id in query (legacy client)")
	}
	defer r.sessionContext.Clear()

	chunkCount := 0
	for {
		messageType, data, err := conn.ReadMessage()
		if err != nil {
			log.Printf("[AudioReceiver] Read error: %v", err)
			return
		}

		switch messageType {
		case websocket.BinaryMessage:
			// Binary audio data - raw PCM Int16 at 16kHz, no timestamp
			select {
			case r.outCh <- data:
				chunkCount++
				if chunkCount == 1 {
					log.Printf("[AudioReceiver] First audio chunk received: %d bytes", len(data))
				} else if chunkCount%100 == 0 {
					log.Printf("[AudioReceiver] Received %d chunks", chunkCount)
				}
			default:
				// Channel full, drop
			}

		case websocket.TextMessage:
			// JSON message (status, etc)
			log.Printf("[AudioReceiver] Text from extension: %s", string(data))
		}
	}
}
