// Package audioReceiver receives audio from the Chrome extension via WebSocket.
package audioReceiver

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

// AudioReceiver receives raw PCM audio from Chrome extension.
type AudioReceiver struct {
	addr   string
	outCh  chan []byte
	server *http.Server
}

// NewAudioReceiver creates a new audio receiver listening on the given address.
func NewAudioReceiver(addr string, outCh chan []byte) *AudioReceiver {
	return &AudioReceiver{
		addr:  addr,
		outCh: outCh,
	}
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
	conn, err := upgrader.Upgrade(w, req, nil)
	if err != nil {
		log.Printf("[AudioReceiver] Upgrade error: %v", err)
		return
	}
	defer conn.Close()

	log.Printf("[AudioReceiver] Extension connected")

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
