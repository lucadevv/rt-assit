// Package main is the entry point for rtassist transcription service.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strconv"
	"strings"
	"syscall"

	"github.com/rtassist/rt_go/internal/pipeline"
)

var (
	version   = "dev"
	buildDate = "unknown"
)

func main() {
	showVersion := flag.Bool("version", false, "Show version info")
	flag.Parse()

	if *showVersion {
		fmt.Printf("rtassist %s (built %s)\n", version, buildDate)
		return
	}

	printBanner()

	// Load .env file
	loadDotEnv()

	// Get configuration
	deepgramKey := os.Getenv("DEEPGRAM_API_KEY")
	if deepgramKey == "" {
		log.Fatal("❌ DEEPGRAM_API_KEY is required")
	}

	overlayPort := getEnvInt("OVERLAY_PORT", 8765)
	audioRecvPort := getEnvInt("AUDIO_RECV_PORT", 8766)
	backendURL := os.Getenv("BACKEND_URL")

	// Flux / Eager End of Turn configuration
	useFlux := os.Getenv("USE_FLUX") == "true"
	eagerEOTThreshold := 0.6 // Default threshold
	if eotStr := os.Getenv("EAGER_EOT_THRESHOLD"); eotStr != "" {
		if eot, err := strconv.ParseFloat(eotStr, 64); err == nil {
			eagerEOTThreshold = eot
		}
	}

	log.Printf("Starting with Deepgram key: %s...", deepgramKey[:min(8, len(deepgramKey))])
	if useFlux {
		log.Printf("Using Flux with EagerEOT threshold: %.1f", eagerEOTThreshold)
	}

	// Create pipeline
	p := pipeline.New(pipeline.Config{
		OverlayPort:       overlayPort,
		AudioRecvPort:     audioRecvPort,
		DeepgramKey:       deepgramKey,
		BackendURL:        backendURL,
		UseFlux:           useFlux,
		EagerEOTThreshold: eagerEOTThreshold,
	})

	// Start pipeline
	if err := p.Start(); err != nil {
		log.Fatalf("❌ Pipeline error: %v", err)
	}

	fmt.Println()
	fmt.Println("✅ rtassist transcription service is running!")
	fmt.Printf("   WebSocket (for clients): ws://localhost:%d\n", overlayPort)
	fmt.Printf("   Audio from Extension: ws://localhost:%d\n", audioRecvPort)
	fmt.Println()
	fmt.Println("📌 Open a Meet/Teams/Zoom call in Chrome")
	fmt.Println()
	fmt.Println("   Press Ctrl+C to stop")
	fmt.Println()

	// Wait for shutdown
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)
	<-sigCh

	fmt.Println("\n⏹️  Shutting down...")
	p.Stop()
	fmt.Println("👋 Goodbye")
}

func printBanner() {
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════╗")
	fmt.Println("║     rtassist - Transcription       ║")
	fmt.Println("║          Service v%s             ║", version)
	fmt.Println("╚══════════════════════════════════════╝")
}

func loadDotEnv() {
	envPath := ".env"
	if exe, err := os.Executable(); err == nil {
		if p := filepath.Join(filepath.Dir(exe), ".env"); fileExists(p) {
			envPath = p
		}
	}

	if !fileExists(envPath) {
		return
	}

	data, _ := os.ReadFile(envPath)
	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		if parts := strings.SplitN(line, "=", 2); len(parts) == 2 {
			os.Setenv(parts[0], parts[1])
		}
	}
}

func fileExists(path string) bool {
	_, err := os.Stat(path)
	return err == nil
}

func getEnvInt(key string, defaultValue int) int {
	if v := os.Getenv(key); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			return n
		}
	}
	return defaultValue
}
