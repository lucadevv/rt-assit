// Package overlay provides WebSocket server for UI overlay communication.
package overlay

import (
	"context"
	"fmt"
	"log"
	"net/http"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for localhost development
	},
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

// Server is a WebSocket server for the overlay UI.
type Server struct {
	hub    *Hub
	server *http.Server
}

// NewServer creates a new WebSocket server.
func NewServer(addr string) *Server {
	hub := NewHub()

	mux := http.NewServeMux()
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(hub, w, r)
	})

	return &Server{
		hub: hub,
		server: &http.Server{
			Addr:    addr,
			Handler: mux,
		},
	}
}

// Start begins serving WebSocket connections.
func (s *Server) Start(ctx context.Context) error {
	// Start hub in background
	go s.hub.Run()

	// Start HTTP server
	errCh := make(chan error, 1)
	go func() {
		if err := s.server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return fmt.Errorf("server error: %w", err)
	case <-ctx.Done():
		return s.server.Shutdown(context.Background())
	}
}

// Stop gracefully shuts down the server.
func (s *Server) Stop() error {
	return s.server.Shutdown(context.Background())
}

// Hub returns the server's hub.
func (s *Server) Hub() *Hub {
	return s.hub
}

func handleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[WebSocket] upgrade error: %v", err)
		return
	}

	log.Printf("[WebSocket] Client connected! Total clients: %d", len(hub.clients)+1)

	client := &Client{
		hub:  hub,
		conn: conn,
		send: make(chan []byte, 256),
	}

	hub.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

func (c *Client) writePump() {
	defer func() {
		c.hub.unregister <- c
		log.Printf("[WebSocket] Client disconnected")
		if conn, ok := c.conn.(*websocket.Conn); ok {
			conn.Close()
		}
	}()

	for message := range c.send {
		if conn, ok := c.conn.(*websocket.Conn); ok {
			log.Printf("[WebSocket] Sending message: %s", string(message))
			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				log.Printf("[WebSocket] Write error: %v", err)
				return
			}
		}
	}
}

func (c *Client) readPump() {
	defer func() {
		c.hub.unregister <- c
		if conn, ok := c.conn.(*websocket.Conn); ok {
			conn.Close()
		}
	}()

	for {
		if conn, ok := c.conn.(*websocket.Conn); ok {
			_, _, err := conn.ReadMessage()
			if err != nil {
				return
			}
		}
	}
}
