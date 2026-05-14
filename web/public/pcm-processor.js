// AudioWorklet processor: Float32 mono input -> Int16 PCM frames posted to the main thread.
// Worklets MUST be JavaScript files served as application/javascript — this is the
// only allowed JS exception in the web/ project.
class PCMProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0];
    if (input && input[0]) {
      const float32 = input[0];
      const int16 = new Int16Array(float32.length);
      for (let i = 0; i < float32.length; i++) {
        int16[i] = Math.max(-32768, Math.min(32767, float32[i] * 32768));
      }
      this.port.postMessage({ pcm: int16.buffer }, [int16.buffer]);
    }
    return true;
  }
}
registerProcessor('pcm-processor', PCMProcessor);
