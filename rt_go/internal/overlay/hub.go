// Package overlay provides WebSocket server for UI overlay communication.
package overlay

import (
	"encoding/json"
	"sync"
	"time"
)

// MessageType represents the type of overlay message.
type MessageType string

const (
	MessageTypeToken      MessageType = "token"
	MessageTypeTranscript MessageType = "transcript"
	MessageTypeError      MessageType = "error"
)

// Message represents a message sent to the UI overlay.
type Message struct {
	Type    MessageType `json:"type"`
	Content string      `json:"content"`
	Ms      int64       `json:"ms"`
	IsFinal bool        `json:"is_final"`
	Speaker int         `json:"speaker,omitempty"` // Speaker ID (0 = unknown)
}

// Client represents a connected UI client.
type Client struct {
	hub  *Hub
	conn interface{} // *websocket.Conn
	send chan []byte
	id   string
}

// Hub maintains the set of active clients.
type Hub struct {
	clients    map[*Client]bool
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.RWMutex
}

// NewHub creates a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		clients:    make(map[*Client]bool),
		broadcast:  make(chan []byte, 256),
		register:   make(chan *Client),
		unregister: make(chan *Client),
	}
}

// Run starts the hub's main loop.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client] = true
			h.mu.Unlock()

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.send)
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.RLock()
			for client := range h.clients {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(h.clients, client)
				}
			}
			h.mu.RUnlock()
		}
	}
}

// Broadcast sends a message to all connected clients.
func (h *Hub) Broadcast(msg Message) {
	data, err := json.Marshal(msg)
	if err != nil {
		return
	}

	select {
	case h.broadcast <- data:
	default:
		// Broadcast channel full
	}
}

// BroadcastToken sends a token to all clients.
func (h *Hub) BroadcastToken(content string) {
	h.Broadcast(Message{
		Type:    MessageTypeToken,
		Content: content,
		Ms:      time.Now().UnixMilli(),
	})
}

// BroadcastTranscript sends a transcript to all clients.
// isFinal=false means an interim update (replaces previous interim on the client);
// isFinal=true means a committed utterance.
func (h *Hub) BroadcastTranscript(text string, isFinal bool, speaker int) {
	h.Broadcast(Message{
		Type:    MessageTypeTranscript,
		Content: text,
		IsFinal: isFinal,
		Speaker: speaker,
		Ms:      time.Now().UnixMilli(),
	})
}

// BroadcastError sends an error to all clients.
func (h *Hub) BroadcastError(err string) {
	h.Broadcast(Message{
		Type:    MessageTypeError,
		Content: err,
		Ms:      time.Now().UnixMilli(),
	})
}

// ClientCount returns the number of connected clients.
func (h *Hub) ClientCount() int {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return len(h.clients)
}
