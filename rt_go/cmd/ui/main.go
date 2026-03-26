package main

import (
	"flag"
	"fmt"
	"log"
	"net/http"
	"os"
	"os/signal"
	"sync"
	"syscall"

	"github.com/gorilla/websocket"
)

var (
	port       = flag.Int("port", 8080, "HTTP server port")
	overlayURL = flag.String("overlay", "ws://localhost:8765/ws", "Overlay WebSocket URL")
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

func main() {
	flag.Parse()

	// Serve static files from clients/html
	fs := http.FileServer(http.Dir("clients/html"))
	http.Handle("/", fs)

	// WebSocket proxy endpoint
	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		// Connect to backend overlay
		backend, _, err := websocket.DefaultDialer.Dial(*overlayURL, nil)
		if err != nil {
			http.Error(w, "Backend unavailable", 503)
			return
		}
		defer backend.Close()

		// Upgrade client connection
		client, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		defer client.Close()

		// Bidirectional proxy
		done := make(chan struct{})
		closeOnce := sync.Once{}

		// Client -> Backend
		go func() {
			defer func() { closeOnce.Do(func() { close(done) }) }()
			for {
				mt, msg, err := client.ReadMessage()
				if err != nil {
					return
				}
				if err := backend.WriteMessage(mt, msg); err != nil {
					return
				}
			}
		}()

		// Backend -> Client
		go func() {
			defer func() { closeOnce.Do(func() { close(done) }) }()
			for {
				mt, msg, err := backend.ReadMessage()
				if err != nil {
					return
				}
				if err := client.WriteMessage(mt, msg); err != nil {
					return
				}
			}
		}()

		<-done
	})

	fmt.Println("╔══════════════════════════════════════╗")
	fmt.Println("║        rtassist UI Server           ║")
	fmt.Println("╚══════════════════════════════════════╝")
	fmt.Printf("🌐 Open: http://localhost:%d\n", *port)
	fmt.Printf("🔌 Proxying WebSocket to: %s\n", *overlayURL)
	fmt.Println()

	// Handle graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		fmt.Println("\n👋 Goodbye!")
		os.Exit(0)
	}()

	log.Fatal(http.ListenAndServe(fmt.Sprintf(":%d", *port), nil))
}
