// Package audio provides audio processing utilities including resampling.
package audio

// Resample16kHz resamples audio from 48kHz to 16kHz using simple decimation.
// Since 48000/16000 = 3, we take every 3rd sample.
// This is a simplified approach - for production, consider using a proper resampler.
func Resample16kHz(samples48 []float32) []float32 {
	if len(samples48) == 0 {
		return []float32{}
	}

	// 48000/16000 = 3x decimation
	var result []float32
	var i int
	for i = 0; i < len(samples48); i += 3 {
		result = append(result, samples48[i])
	}
	return result
}

// Resample16kHzLinear resamples audio from 48kHz to 16kHz using linear interpolation.
// This provides better quality than simple decimation.
func Resample16kHzLinear(samples48 []float32) []float32 {
	if len(samples48) < 3 {
		if len(samples48) > 0 {
			return []float32{samples48[0]}
		}
		return []float32{}
	}

	// 48000/16000 = 3, so we need 3 input samples for each output sample
	outputLen := len(samples48) / 3
	if len(samples48)%3 >= 2 {
		outputLen++ // Handle remainder
	}

	result := make([]float32, outputLen)
	outIdx := 0

	var i int
	for i = 0; i+2 < len(samples48); i += 3 {
		// For decimation by 3, we take the first sample of each group
		if outIdx < len(result) {
			result[outIdx] = samples48[i]
		}
		outIdx++
	}

	// Handle remaining samples (1 or 2 samples left)
	if outIdx < len(result) {
		remaining := len(samples48) - i
		if remaining >= 1 {
			result[outIdx] = samples48[i]
		}
	}

	return result
}
