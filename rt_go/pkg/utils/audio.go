// Package utils provides audio processing helpers.
package utils

import (
	"encoding/base64"
	"math"
)

// Base64ToPCM decodes base64 audio to PCM bytes.
func Base64ToPCM(b64 string) ([]byte, error) {
	return base64.StdEncoding.DecodeString(b64)
}

// PCMToBase64 encodes PCM bytes to base64.
func PCMToBase64(pcm []byte) string {
	return base64.StdEncoding.EncodeToString(pcm)
}

// CalculateRMS calculates the root mean square energy of PCM audio.
func CalculateRMS(data []byte) float64 {
	if len(data) < 2 {
		return 0
	}

	var sum float64
	samples := len(data) / 2

	for i := 0; i < len(data)-1; i += 2 {
		// Little-endian 16-bit signed integer
		sample := int16(data[i]) | (int16(data[i+1]) << 8)
		normalized := float64(sample) / 32768.0
		sum += normalized * normalized
	}

	if samples == 0 {
		return 0
	}

	return math.Sqrt(sum / float64(samples))
}

// IsSilence checks if audio chunk is silence based on energy threshold.
func IsSilence(data []byte, threshold float64) bool {
	rms := CalculateRMS(data)
	return rms < threshold
}

// SplitIntoChunks splits audio into chunks of specified duration.
// sampleRate is in Hz, chunkDurationMs is in milliseconds.
func SplitIntoChunks(data []byte, sampleRate int, chunkDurationMs int) [][]byte {
	bytesPerSample := 2 // 16-bit = 2 bytes
	samplesPerChunk := (sampleRate * chunkDurationMs) / 1000
	bytesPerChunk := samplesPerChunk * bytesPerSample

	var chunks [][]byte
	for i := 0; i < len(data); i += bytesPerChunk {
		end := i + bytesPerChunk
		if end > len(data) {
			end = len(data)
		}
		chunks = append(chunks, data[i:end])
	}

	return chunks
}

// MergeChunks merges multiple audio chunks into a single buffer.
func MergeChunks(chunks [][]byte) []byte {
	var totalLen int
	for _, c := range chunks {
		totalLen += len(c)
	}

	result := make([]byte, 0, totalLen)
	for _, c := range chunks {
		result = append(result, c...)
	}

	return result
}
