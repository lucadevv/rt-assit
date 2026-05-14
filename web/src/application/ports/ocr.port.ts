/**
 * OcrPort — extracts text from a raster image.
 *
 * Implementations: TesseractAdapter (client-side, privacy-first) or
 * future CloudOcrAdapter (server-proxied Google Vision / OpenAI Vision)
 * for paid tiers.
 */
export interface OcrResult {
  text: string;
  confidence: number; // 0-1
  durationMs: number;
}

export interface OcrPort {
  /**
   * Extract text from an image (raw ImageData or canvas).
   * Languages should be set at construction; this method is stateless.
   */
  extractText(image: ImageData | HTMLCanvasElement): Promise<OcrResult>;
  /**
   * Free underlying resources (Tesseract worker, etc).
   * Safe to call multiple times.
   */
  dispose(): Promise<void>;
}
