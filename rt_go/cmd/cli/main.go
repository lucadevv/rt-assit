package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"strings"
	"syscall"

	"github.com/gorilla/websocket"
)

var (
	overlayURL = flag.String("overlay", "ws://localhost:8765/ws", "Overlay WebSocket URL")
	audioURL   = flag.String("audio", "ws://localhost:8766", "Audio WebSocket URL")
	quiet      = flag.Bool("q", false, "Quiet mode - only show transcripts")
)

func main() {
	flag.Parse()

	fmt.Println("╔══════════════════════════════════════╗")
	fmt.Println("║        rtassist CLI Client           ║")
	fmt.Println("╚══════════════════════════════════════╝")
	fmt.Println()

	// Connect to overlay WebSocket
	conn, _, err := websocket.DefaultDialer.Dial(*overlayURL, nil)
	if err != nil {
		fmt.Printf("❌ Failed to connect to overlay: %v\n", *overlayURL)
		os.Exit(1)
	}
	defer conn.Close()

	fmt.Printf("✅ Connected to overlay: %s\n", *overlayURL)
	fmt.Println()
	fmt.Println("📝 Transcripción en vivo:")
	fmt.Println("────────────────────────────────────────")

	// Handle graceful shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	go func() {
		<-sigCh
		fmt.Println("\n👋 Goodbye!")
		os.Exit(0)
	}()

	// Read messages
	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			log.Printf("Error reading: %v", err)
			break
		}

		msg := string(message)

		// Parse and display based on message type
		if strings.Contains(msg, `"type":"transcript"`) {
			if content := extractContent(msg); content != "" {
				if !*quiet {
					fmt.Printf("🎤 %s\n", content)
				} else {
					fmt.Println(content)
				}
			}
		} else if strings.Contains(msg, `"type":"token"`) {
			if content := extractContent(msg); content != "" {
				fmt.Print(content)
			}
		} else if strings.Contains(msg, `"type":"thinking"`) {
			if content := extractContent(msg); content != "" {
				fmt.Printf("\n🤔 %s\n", content)
			}
		} else if strings.Contains(msg, `"type":"error"`) {
			if content := extractContent(msg); content != "" {
				fmt.Printf("❌ Error: %s\n", content)
			}
		}
	}
}

func extractContent(msg string) string {
	// Simple extraction - look for "content":"..."
	start := strings.Index(msg, `"content":"`)
	if start == -1 {
		return ""
	}
	start += len(`"content":"`)
	end := strings.Index(msg[start:], `"`)
	if end == -1 {
		return ""
	}
	return msg[start : start+end]
}
