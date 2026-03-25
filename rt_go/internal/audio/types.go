// Package audio provides voice activity detection and audio buffering.
package audio

import (
	"time"
)

// EnergyThreshold is the RMS energy level below which audio is considered silence.
const EnergyThreshold = 0.005 // Lowered from 0.03 for quieter audio

// SilenceDuration is the duration of silence required to end an utterance.
const SilenceDuration = 600 * time.Millisecond

// MaxUtteranceDuration is the maximum duration of a single utterance.
const MaxUtteranceDuration = 10 * time.Second

// ChunkDuration is the size of each audio chunk.
const ChunkDuration = 250 * time.Millisecond

// AudioChunk represents a chunk of audio data.
type AudioChunk struct {
	Data      []byte
	Timestamp time.Time
}

// Utterance represents a complete utterance (speech segment).
type Utterance struct {
	Audio    []byte
	Duration time.Duration
}
