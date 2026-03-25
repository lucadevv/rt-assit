// Package cdp provides Chrome DevTools Protocol integration for audio capture.
package cdp

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/chromedp/cdproto/runtime"
	"github.com/chromedp/cdproto/target"
	"github.com/chromedp/chromedp"
)

// Connector manages the connection to Chrome via CDP.
type Connector struct {
	port         int
	ctx          context.Context
	cancel       context.CancelFunc
	targetCtx    context.Context
	targetCancel context.CancelFunc
}

// PollInterval is how often we check for new Meet tabs
const PollInterval = 3 * time.Second

// NewConnector creates a new Chrome CDP connector.
func NewConnector(port int) *Connector {
	return &Connector{port: port}
}

// chromeVersion represents the response from /json/version endpoint.
type chromeVersion struct {
	WebSocketURL string `json:"webSocketDebuggerUrl"`
}

// Connect establishes a connection to Chrome and returns a target context.
func (c *Connector) Connect(parentCtx context.Context) (context.Context, error) {
	addr := fmt.Sprintf("localhost:%d", c.port)

	// Get the actual WebSocket URL from Chrome's /json/version endpoint
	wsURL, err := c.getWebSocketURL(addr)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Chrome at %s: %w (is Chrome running with --remote-debugging-port=%d?)", addr, err, c.port)
	}

	// Create allocator context for remote browser
	allocCtx, allocCancel := chromedp.NewRemoteAllocator(parentCtx, wsURL)
	c.ctx, c.cancel = chromedp.NewContext(allocCtx)
	_ = allocCancel // allocator context will be cancelled when parent cancels

	// Run a simple action to verify connection
	if err := chromedp.Run(c.ctx); err != nil {
		return nil, fmt.Errorf("failed to connect to Chrome at %s: %w", addr, err)
	}

	// Get all targets and find a suitable one
	targets, err := chromedp.Targets(c.ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to get targets: %w", err)
	}

	// Find a suitable target (page, not about:blank)
	for _, t := range targets {
		if t.Type == "page" && t.URL != "" && t.URL != "about:blank" {
			c.targetCtx, c.targetCancel = chromedp.NewContext(c.ctx, chromedp.WithTargetID(t.TargetID))
			return c.targetCtx, nil
		}
	}

	// If no suitable target found, create a new context for the first available page
	// or return an error with instructions
	if len(targets) > 0 {
		// Use the first page target
		for _, t := range targets {
			if t.Type == "page" {
				c.targetCtx, c.targetCancel = chromedp.NewContext(c.ctx, chromedp.WithTargetID(t.TargetID))
				return c.targetCtx, nil
			}
		}
	}

	// No page targets found - return the browser context and let caller handle it
	return c.ctx, nil
}

// getWebSocketURL fetches the WebSocket debugger URL from Chrome.
func (c *Connector) getWebSocketURL(addr string) (string, error) {
	url := fmt.Sprintf("http://%s/json/version", addr)

	client := &http.Client{Timeout: 5 * time.Second}
	resp, err := client.Get(url)
	if err != nil {
		return "", fmt.Errorf("failed to reach Chrome: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("Chrome returned status %d", resp.StatusCode)
	}

	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", fmt.Errorf("failed to read Chrome response: %w", err)
	}

	var version chromeVersion
	if err := json.Unmarshal(body, &version); err != nil {
		return "", fmt.Errorf("failed to parse Chrome response: %w", err)
	}

	if version.WebSocketURL == "" {
		return "", fmt.Errorf("no WebSocket debugger URL found in Chrome response")
	}

	return version.WebSocketURL, nil
}

// Disconnect closes the CDP connection.
func (c *Connector) Disconnect() {
	if c.targetCancel != nil {
		c.targetCancel()
	}
	if c.cancel != nil {
		c.cancel()
	}
}

// BrowserContext returns the browser-level context.
func (c *Connector) BrowserContext() context.Context {
	return c.ctx
}

// WaitForMeetAndInject continuously monitors for Meet tabs and injects the capture script.
// It returns when a Meet tab is found and script is injected, or when context is cancelled.
func (c *Connector) WaitForMeetAndInject(ctx context.Context) error {
	ticker := time.NewTicker(PollInterval)
	defer ticker.Stop()

	log.Println("[CDP] Waiting for Meet tab...")

	for {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
			targets, err := chromedp.Targets(c.ctx)
			if err != nil {
				log.Printf("[CDP] Failed to get targets: %v", err)
				continue
			}

			for _, t := range targets {
				if !isMeetTarget(t) {
					continue
				}

				log.Printf("[CDP] Found Meet tab: %s", t.URL)

				// Create context for this specific target
				targetCtx, targetCancel := chromedp.NewContext(c.ctx, chromedp.WithTargetID(t.TargetID))

				// Inject script into this tab
				err = chromedp.Run(targetCtx,
					runtime.Enable(),
					runtime.AddBinding("rtassistAudio"),
					chromedp.Evaluate(JSInjection, nil),
				)
				targetCancel()

				if err != nil {
					log.Printf("[CDP] Failed to inject script into Meet tab: %v", err)
					continue
				}

				log.Println("[CDP] Script injected into Meet tab successfully")
				return nil
			}
		}
	}
}

// InjectIntoAllTabs injects the capture script into ALL page tabs with HTTP/HTTPS URLs.
// This ensures we capture audio from Meet regardless of which tab is active.
// Skips Chrome internal pages (chrome://, about:, etc.)
func (c *Connector) InjectIntoAllTabs(ctx context.Context) error {
	targets, err := chromedp.Targets(c.ctx)
	if err != nil {
		return fmt.Errorf("failed to get targets: %w", err)
	}

	injected := 0
	for _, t := range targets {
		if t.Type != "page" {
			continue
		}

		// Skip Chrome internal pages - they have read-only RTCPeerConnection
		if !isWebURL(t.URL) {
			log.Printf("[CDP] Skipping internal tab: %s", t.URL)
			continue
		}

		targetCtx, targetCancel := chromedp.NewContext(c.ctx, chromedp.WithTargetID(t.TargetID))

		err = chromedp.Run(targetCtx,
			runtime.Enable(),
			runtime.AddBinding("rtassistAudio"),
			chromedp.Evaluate(JSInjection, nil),
		)
		targetCancel()

		if err != nil {
			log.Printf("[CDP] Failed to inject into tab %s: %v", t.URL, err)
			continue
		}

		injected++
		log.Printf("[CDP] Injected script into tab: %s", t.URL)
	}

	if injected == 0 {
		return fmt.Errorf("no web tabs found to inject script")
	}

	log.Printf("[CDP] Script injected into %d tab(s)", injected)
	return nil
}

// isMeetTarget returns true if the target is a Google Meet, Teams, or Zoom tab.
func isMeetTarget(t *target.Info) bool {
	if t.Type != "page" {
		return false
	}
	// Must be a web URL (not chrome://, about:, etc.)
	if !isWebURL(t.URL) {
		return false
	}
	url := strings.ToLower(t.URL)
	title := strings.ToLower(t.Title)
	return strings.Contains(url, "meet.google.com") ||
		strings.Contains(url, "teams.microsoft.com") ||
		strings.Contains(url, "teams.live.com") ||
		strings.Contains(url, "zoom.us") ||
		strings.Contains(title, "google meet") ||
		strings.Contains(title, "microsoft teams") ||
		strings.Contains(title, "zoom meeting")
}

// isWebURL returns true if the URL is a web page (HTTP/HTTPS).
// Chrome internal pages (chrome://, about:, file://, etc.) return false.
func isWebURL(urlStr string) bool {
	return strings.HasPrefix(urlStr, "http://") || strings.HasPrefix(urlStr, "https://")
}
