// Package cdp provides Chrome DevTools Protocol integration for audio capture.
package cdp

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"log"

	"github.com/chromedp/cdproto/runtime"
	"github.com/chromedp/chromedp"
)

const bindingName = "rtassistAudio"

// Capturer receives audio chunks from Chrome via CDP.
type Capturer struct {
	outCh      chan<- []byte
	chunkCount int
}

// NewCapturer creates a new audio capturer.
func NewCapturer(outCh chan<- []byte) *Capturer {
	return &Capturer{
		outCh: outCh,
	}
}

// audioPayload represents the JSON payload from the injected script.
type audioPayload struct {
	Data      string `json:"data"`
	Format    string `json:"format"`
	Timestamp int64  `json:"timestamp"`
}

// Start begins capturing audio from Chrome.
// NOTE: CDP injection is DISABLED - audio capture is now done via Chrome Extension.
func (c *Capturer) Start(ctx context.Context) error {
	// Start listening for CDP events (for legacy compatibility)
	chromedp.ListenTarget(ctx, func(ev interface{}) {
		switch ev := ev.(type) {
		case *runtime.EventBindingCalled:
			if ev.Name == bindingName {
				c.handleAudioPayload(ev.Payload)
			}
		}
	})

	// CDP injection is disabled - Meet blocks RTCPeerConnection override
	// Audio capture is now done via Chrome Extension (tabCapture)
	// The extension connects to ws://localhost:8766/audio

	log.Println("[CDP] Audio capture initialized (CDP injection DISABLED)")
	log.Println("[CDP] Audio capture is now done via Chrome Extension")

	return nil
}

// handleAudioPayload processes incoming audio data from the browser.
func (c *Capturer) handleAudioPayload(payload string) {
	var ap audioPayload
	if err := json.Unmarshal([]byte(payload), &ap); err != nil {
		log.Printf("[CDP] Failed to parse audio payload: %v", err)
		return
	}

	// Decode base64 audio data
	audioData, err := base64.StdEncoding.DecodeString(ap.Data)
	if err != nil {
		log.Printf("[CDP] Failed to decode base64 audio: %v", err)
		return
	}

	// Send to output channel (non-blocking)
	select {
	case c.outCh <- audioData:
		// Audio sent successfully
		c.chunkCount++
		if c.chunkCount == 1 {
			log.Printf("[CDP] First audio chunk received: %d bytes", len(audioData))
		} else if c.chunkCount%100 == 0 {
			log.Printf("[CDP] Sent %d audio chunks to pipeline", c.chunkCount)
		}
	default:
		// Channel full, drop audio chunk
		log.Printf("[CDP] Audio channel full, dropping chunk")
	}
}
