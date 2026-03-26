package overlay

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

type Peer struct {
	conn *websocket.Conn
	send chan []byte
}

type RTCHub struct {
	peers      map[*Peer]bool
	broadcast  chan []byte
	register   chan *Peer
	unregister chan *Peer
	mutex      sync.RWMutex
}

func NewRTCHub() *RTCHub {
	return &RTCHub{
		peers:      make(map[*Peer]bool),
		broadcast:  make(chan []byte),
		register:   make(chan *Peer),
		unregister: make(chan *Peer),
	}
}

func (h *RTCHub) Run() {
	for {
		select {
		case peer := <-h.register:
			h.mutex.Lock()
			h.peers[peer] = true
			h.mutex.Unlock()

		case peer := <-h.unregister:
			h.mutex.Lock()
			if _, ok := h.peers[peer]; ok {
				delete(h.peers, peer)
				close(peer.send)
			}
			h.mutex.Unlock()

		case message := <-h.broadcast:
			h.mutex.RLock()
			for peer := range h.peers {
				select {
				case peer.send <- message:
				default:
					close(peer.send)
					delete(h.peers, peer)
				}
			}
			h.mutex.RUnlock()
		}
	}
}

func (h *RTCHub) Register(peer *Peer) {
	h.register <- peer
}

func (h *RTCHub) Unregister(peer *Peer) {
	h.unregister <- peer
}

func (h *RTCHub) Broadcast(msg interface{}) {
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("[RTC] Marshal error: %v", err)
		return
	}
	h.broadcast <- data
}

type RTCMessage struct {
	Type    string      `json:"type"`
	Payload interface{} `json:"payload,omitempty"`
}

func (h *RTCHub) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[RTC] Upgrade error: %v", err)
		return
	}

	peer := &Peer{
		conn: conn,
		send: make(chan []byte, 256),
	}

	h.Register(peer)

	go func() {
		defer func() {
			h.Unregister(peer)
			conn.Close()
		}()

		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
					log.Printf("[RTC] Read error: %v", err)
				}
				break
			}

			// Handle RTC signaling messages
			var msg RTCMessage
			if err := json.Unmarshal(message, &msg); err != nil {
				log.Printf("[RTC] Unmarshal error: %v", err)
				continue
			}

			// Handle SDP offer/answer, ICE candidates, etc.
			log.Printf("[RTC] Received: %s", msg.Type)
		}
	}()

	go func() {
		defer func() {
			h.Unregister(peer)
			conn.Close()
		}()

		for {
			message, ok := <-peer.send
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := conn.WriteMessage(websocket.TextMessage, message); err != nil {
				break
			}
		}
	}()
}
