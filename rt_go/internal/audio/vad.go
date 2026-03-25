// Package audio provides voice activity detection.
package audio

import (
	"log"
	"math"
	"time"
)

// VAD performs voice activity detection on audio chunks using RMS energy.
type VAD struct {
	threshold   float64
	silenceDur  time.Duration
	maxDuration time.Duration

	silenceStart time.Time
	isSpeaking   bool
	speechStart  time.Time
	energyCount  int
}

// NewVAD creates a new VAD instance.
func NewVAD() *VAD {
	return &VAD{
		threshold:   EnergyThreshold,
		silenceDur:  SilenceDuration,
		maxDuration: MaxUtteranceDuration,
	}
}

// Process examines an audio chunk and returns true if speech is detected.
func (v *VAD) Process(chunk []byte) bool {
	energy := calculateEnergy(chunk)

	// Log first few chunks to calibrate threshold
	if v.energyCount < 5 {
		log.Printf("[VAD] Energy #%d: %.4f (threshold: %.4f)", v.energyCount+1, energy, v.threshold)
		v.energyCount++
	}
	now := time.Now()

	if energy > v.threshold {
		if !v.isSpeaking {
			v.speechStart = now
		}
		v.silenceStart = time.Time{}
		v.isSpeaking = true
		return true
	}

	// Check silence duration
	if v.isSpeaking {
		if v.silenceStart.IsZero() {
			v.silenceStart = now
		} else if time.Since(v.silenceStart) >= v.silenceDur {
			v.isSpeaking = false
			return false
		}
	}

	return v.isSpeaking
}

// Reset clears the VAD state.
func (v *VAD) Reset() {
	v.silenceStart = time.Time{}
	v.isSpeaking = false
	v.speechStart = time.Time{}
}

// IsSpeaking returns whether the VAD is currently in a speech segment.
func (v *VAD) IsSpeaking() bool {
	return v.isSpeaking
}

// calculateEnergy computes the RMS energy of a 16-bit PCM audio chunk.
func calculateEnergy(chunk []byte) float64 {
	if len(chunk) < 2 {
		return 0
	}

	samples := len(chunk) / 2
	var sum float64

	for i := 0; i < samples; i++ {
		// Little-endian 16-bit signed integer
		sample := int16(chunk[2*i]) | (int16(chunk[2*i+1]) << 8)
		normalized := float64(sample) / 32768.0
		sum += normalized * normalized
	}

	return math.Sqrt(sum / float64(samples))
}
