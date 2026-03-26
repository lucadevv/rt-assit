// Package main is the entry point for rtassist.
package main

import (
	"flag"
	"fmt"
	"log"
	"os"
	"os/signal"
	"path/filepath"
	"strings"
	"syscall"

	"github.com/rtassist/rt_go/internal/config"
	"github.com/rtassist/rt_go/internal/pipeline"
)

// loadDotEnv loads .env file from the same directory
func loadDotEnv() {
	exe, err := os.Executable()
	if err != nil {
		return
	}
	envPath := filepath.Join(filepath.Dir(exe), ".env")
	if _, err := os.Stat(envPath); os.IsNotExist(err) {
		// Try current directory
		envPath = ".env"
	}

	data, err := os.ReadFile(envPath)
	if err != nil {
		return
	}

	for _, line := range strings.Split(string(data), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		parts := strings.SplitN(line, "=", 2)
		if len(parts) == 2 {
			os.Setenv(parts[0], parts[1])
		}
	}
}

// Build info (set via ldflags)
var (
	version   = "dev"
	buildDate = "unknown"
)

func main() {
	// CLI flags
	showVersion := flag.Bool("version", false, "Show version info")
	flag.Parse()

	if *showVersion {
		fmt.Printf("rtassist %s (built %s)\n", version, buildDate)
		return
	}

	// Load .env file directly
	loadDotEnv()

	// Debug: show what was loaded
	if key := os.Getenv("DEEPGRAM_API_KEY"); len(key) > 8 {
		log.Printf("DEBUG: DEEPGRAM_API_KEY loaded: %s...", key[:8])
	} else {
		log.Printf("DEBUG: DEEPGRAM_API_KEY NOT loaded or empty!")
	}

	// Print banner
	printBanner()

	// Load configuration
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("❌ Configuration error: %v\n\n   Run: make env-setup\n   Then edit .env with your API keys", err)
	}

	log.Printf("Configuration: %s", cfg.String())

	// Create pipeline
	p := pipeline.New(pipeline.Config{
		ChromePort:    cfg.ChromePort,
		OverlayPort:   cfg.OverlayPort,
		AudioRecvPort: cfg.AudioRecvPort,
		DeepgramKey:   cfg.DeepgramAPIKey,
		LLMProvider:   cfg.LLMProvider,
		LLMKey:        cfg.LLMAPIKey,
		LLMBaseURL:    cfg.LLMBaseURL,
		LLMModel:      cfg.LLMModel,
		SystemPrompt:  cfg.SystemPrompt,
	})

	// Start pipeline
	if err := p.Start(); err != nil {
		log.Fatalf("❌ Pipeline error: %v", err)
	}

	// Print startup info
	fmt.Println()
	fmt.Println("✅ rtassist is running!")
	fmt.Printf("   Chrome CDP: localhost:%d\n", cfg.ChromePort)
	fmt.Printf("   Overlay:    ws://localhost:%d\n", cfg.OverlayPort)
	fmt.Printf("   AudioExt:   ws://localhost:%d (Chrome Extension)\n", cfg.AudioRecvPort)
	fmt.Printf("   LLM:        %s (%s)\n", cfg.LLMModel, cfg.LLMProvider)
	fmt.Println()
	fmt.Println("📌 Open a Meet/Teams/Zoom call in Chrome")
	fmt.Println("   The assistant will help with technical/behavioral questions")
	fmt.Println()
	fmt.Println("   Press Ctrl+C to stop")
	fmt.Println()

	// Handle shutdown signals
	sigCh := make(chan os.Signal, 1)
	signal.Notify(sigCh, syscall.SIGINT, syscall.SIGTERM)

	// Wait for shutdown signal
	<-sigCh
	fmt.Println("\n⏹️  Shutting down...")

	// Graceful shutdown
	p.Stop()

	fmt.Println("👋 Goodbye")
}

func printBanner() {
	fmt.Println()
	fmt.Println("╔══════════════════════════════════════╗")
	fmt.Println("║        rtassist - Interview Helper   ║")
	fmt.Println("║         Deepgram + GLM-4-Flash       ║")
	fmt.Printf("║         Version: %-10s            ║\n", version)
	fmt.Println("╚══════════════════════════════════════╝")
}
