import type { OcrPort } from "@/application/ports/ocr.port";

export interface ScreenTextExtraction {
  text: string;
  confidence: number;
  durationMs: number;
  isNew: boolean; // true if text differs from previous extraction
}

/**
 * ExtractScreenTextUseCase — captures a frame from a video element
 * and runs it through OCR.
 *
 * Stateful: tracks the last extracted text so callers can diff and
 * decide whether to act on the new content (push to store, send to
 * LLM, etc.).
 *
 * The video element must already be playing a MediaStream (e.g. the
 * screen-share stream from getDisplayMedia). We draw the current frame
 * to a transient canvas matching the video's intrinsic resolution and
 * hand that canvas to the OCR port.
 */
export class ExtractScreenTextUseCase {
  private lastText: string = "";

  constructor(private readonly ocr: OcrPort) {}

  async execute(video: HTMLVideoElement): Promise<ScreenTextExtraction> {
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Could not acquire 2D context for OCR canvas");
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const result = await this.ocr.extractText(canvas);
    const isNew = result.text !== this.lastText && result.text.length > 0;
    if (isNew) {
      this.lastText = result.text;
    }
    return { ...result, isNew };
  }

  reset(): void {
    this.lastText = "";
  }
}
