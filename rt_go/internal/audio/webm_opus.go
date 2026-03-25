// Package audio provides voice activity detection and audio buffering.
package audio

import (
	"bytes"
	"encoding/binary"
	"io"

	"github.com/at-wat/ebml-go/mkvcore"
	"github.com/pion/opus"
)

// WebMOpusProcessor parses WebM container with Opus codec and converts to PCM.
type WebMOpusProcessor struct {
	decoder opus.Decoder
}

// NewWebMOpusProcessor creates a new WebM/Opus processor.
func NewWebMOpusProcessor() (*WebMOpusProcessor, error) {
	dec := opus.NewDecoder()
	return &WebMOpusProcessor{
		decoder: dec,
	}, nil
}

// ProcessWebMChunk parses WebM container and returns PCM samples at 16kHz.
func (p *WebMOpusProcessor) ProcessWebMChunk(data []byte) ([]int16, error) {
	if len(data) == 0 {
		return []int16{}, nil
	}

	var allPCM []int16

	// Create a block reader to parse WebM blocks
	blockReaders, err := mkvcore.NewSimpleBlockReader(bytes.NewReader(data))
	if err != nil {
		return nil, err
	}
	defer func() {
		for _, br := range blockReaders {
			if closer, ok := br.(io.Closer); ok {
				closer.Close()
			}
		}
	}()

	// Process each block reader (we expect only one audio track)
	for _, br := range blockReaders {
		if trackGetter, ok := br.(mkvcore.TrackEntryGetter); ok {
			track := trackGetter.TrackEntry()
			// Process only audio tracks (TrackType == 2)
			if track.TrackType == 2 {
				// Read all blocks from this track
				if reader, ok := br.(mkvcore.BlockReader); ok {
					for {
						blockData, _, _, err := reader.Read()
						if err == io.EOF {
							break
						}
						if err != nil {
							continue
						}

						pcm, err := p.decodeOpus(blockData)
						if err != nil || len(pcm) == 0 {
							continue
						}
						allPCM = append(allPCM, pcm...)
					}
				}
			}
		}
	}

	return allPCM, nil
}

// ProcessOpusChunk decodes raw Opus data to PCM 16kHz.
func (p *WebMOpusProcessor) ProcessOpusChunk(data []byte) ([]int16, error) {
	if len(data) == 0 {
		return []int16{}, nil
	}
	return p.decodeOpus(data)
}

// decodeOpus decodes Opus bytes to PCM samples at 16kHz.
func (p *WebMOpusProcessor) decodeOpus(opusData []byte) ([]int16, error) {
	// opus decoder expects []byte output buffer
	pcmBuf := make([]byte, 5760) // Max 60ms * 48kHz * 2 bytes * 1 channel
	n, _, err := p.decoder.Decode(opusData, pcmBuf)
	if err != nil {
		return nil, err
	}

	// Convert []byte to []int16 (little endian)
	pcm48 := make([]int16, n/2)
	for i := 0; i < len(pcm48); i++ {
		pcm48[i] = int16(pcmBuf[2*i]) | (int16(pcmBuf[2*i+1]) << 8)
	}

	// Resample 48kHz -> 16kHz
	pcm16 := resample48to16(pcm48)
	return pcm16, nil
}

// resample48to16 downsamples from 48kHz to 16kHz by taking every 3rd sample.
func resample48to16(pcm48 []int16) []int16 {
	if len(pcm48) < 3 {
		return pcm48
	}
	pcm16 := make([]int16, len(pcm48)/3)
	for i := range pcm16 {
		pcm16[i] = pcm48[i*3]
	}
	return pcm16
}

// PCMToBytes converts []int16 PCM to []byte (little-endian).
func PCMToBytes(pcm []int16) []byte {
	buf := new(bytes.Buffer)
	for _, sample := range pcm {
		binary.Write(buf, binary.LittleEndian, sample)
	}
	return buf.Bytes()
}
