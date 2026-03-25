// Package cdp provides Chrome DevTools Protocol integration for audio capture.
package cdp

import (
	"context"
	"strings"

	"github.com/chromedp/chromedp"
)

// Navigator helps find and navigate to meeting tabs.
type Navigator struct {
	connector *Connector
}

// NewNavigator creates a new Navigator.
func NewNavigator(connector *Connector) *Navigator {
	return &Navigator{connector: connector}
}

// MeetingTab represents a detected meeting tab.
type MeetingTab struct {
	ID    string
	Title string
	URL   string
	Type  MeetingType
}

// MeetingType represents the type of meeting platform.
type MeetingType string

const (
	MeetingTypeGoogleMeet MeetingType = "google_meet"
	MeetingTypeTeams      MeetingType = "teams"
	MeetingTypeZoom       MeetingType = "zoom"
	MeetingTypeUnknown    MeetingType = "unknown"
)

// FindMeetingTab searches for an active meeting tab.
func (n *Navigator) FindMeetingTab(ctx context.Context) (*MeetingTab, error) {
	targets, err := chromedp.Targets(ctx)
	if err != nil {
		return nil, err
	}

	for _, t := range targets {
		url := t.URL
		title := t.Title

		meetingType := detectMeetingType(url, title)
		if meetingType != MeetingTypeUnknown {
			return &MeetingTab{
				ID:    t.TargetID.String(),
				Title: title,
				URL:   url,
				Type:  meetingType,
			}, nil
		}
	}

	return nil, nil
}

// detectMeetingType determines the meeting platform from URL/title.
func detectMeetingType(url, title string) MeetingType {
	urlLower := strings.ToLower(url)
	titleLower := strings.ToLower(title)

	// Google Meet
	if strings.Contains(urlLower, "meet.google.com") {
		return MeetingTypeGoogleMeet
	}

	// Microsoft Teams
	if strings.Contains(urlLower, "teams.live.com") ||
		strings.Contains(urlLower, "teams.microsoft.com") {
		return MeetingTypeTeams
	}

	// Zoom
	if strings.Contains(urlLower, "zoom.us/wc") ||
		strings.Contains(urlLower, "app.zoom.us") {
		return MeetingTypeZoom
	}

	// Heuristic: title contains meeting keywords
	if strings.Contains(titleLower, "google meet") {
		return MeetingTypeGoogleMeet
	}
	if strings.Contains(titleLower, "microsoft teams") || strings.Contains(titleLower, "teams") {
		return MeetingTypeTeams
	}
	if strings.Contains(titleLower, "zoom meeting") || strings.Contains(titleLower, "zoom") {
		return MeetingTypeZoom
	}

	return MeetingTypeUnknown
}
