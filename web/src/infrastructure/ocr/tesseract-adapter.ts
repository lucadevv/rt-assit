"use client";

import type { OcrPort, OcrResult } from "@/application/ports/ocr.port";

/**
 * TesseractAdapter — client-side OCR via tesseract.js (WASM + Web Worker).
 *
 * Privacy positioning: OCR runs ENTIRELY in the user's browser. Nothing
 * leaves the device. No cloud upload, no server hop.
 *
 * The Tesseract module is dynamically imported on the FIRST extraction
 * call so the initial app bundle stays small. The WASM blob and
 * language traineddata files (~5-10MB combined) are fetched from the
 * tesseract.js CDN on first use only.
 *
 * Languages: Spanish + English combined ("spa+eng"). Covers most
 * Susurra users in Latam + bilingual interview/sales contexts.
 */

const TESSERACT_LANGS = "spa+eng";

// Minimal structural type for the tesseract.js worker we depend on,
// so we can avoid `any` while still lazy-importing.
interface TesseractWorker {
  recognize(
    image: ImageData | HTMLCanvasElement,
  ): Promise<{ data: { text?: string; confidence?: number } }>;
  terminate(): Promise<void>;
}

export class TesseractAdapter implements OcrPort {
  private workerPromise: Promise<TesseractWorker> | null = null;

  private async getWorker(): Promise<TesseractWorker> {
    if (!this.workerPromise) {
      this.workerPromise = (async () => {
        // Dynamic import keeps tesseract.js out of the initial bundle.
        const tesseract = await import("tesseract.js");
        const worker = await tesseract.createWorker(TESSERACT_LANGS);
        return worker as unknown as TesseractWorker;
      })();
    }
    return this.workerPromise;
  }

  async extractText(
    image: ImageData | HTMLCanvasElement,
  ): Promise<OcrResult> {
    const t0 = performance.now();
    const worker = await this.getWorker();
    const { data } = await worker.recognize(image);
    return {
      text: (data.text ?? "").trim(),
      confidence:
        typeof data.confidence === "number" ? data.confidence / 100 : 0,
      durationMs: performance.now() - t0,
    };
  }

  async dispose(): Promise<void> {
    if (this.workerPromise) {
      try {
        const worker = await this.workerPromise;
        await worker.terminate();
      } catch {
        // Worker already terminated or never resolved — ignore.
      }
      this.workerPromise = null;
    }
  }
}
