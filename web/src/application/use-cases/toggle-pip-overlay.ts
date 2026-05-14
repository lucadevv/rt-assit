/**
 * TogglePipOverlayUseCase — single-instance gatekeeper around the
 * Document Picture-in-Picture window. Ensures only ONE overlay exists at
 * a time and centralises the support check so presentation can show a
 * disabled state without poking at infrastructure.
 *
 * Rule: requesting `open()` while an overlay is already open closes the
 * previous one first (avoids leaks and duplicate React roots).
 */
import type {
  PipOverlayHandle,
  PipOverlayPort,
} from "@/application/ports/pip-overlay.port";

export class TogglePipOverlayUseCase {
  private currentHandle: PipOverlayHandle | null = null;

  constructor(private readonly pip: PipOverlayPort) {}

  isSupported(): boolean {
    return this.pip.isSupported();
  }

  isOpen(): boolean {
    return this.currentHandle?.isOpen() ?? false;
  }

  getHandle(): PipOverlayHandle | null {
    if (this.currentHandle?.isOpen()) return this.currentHandle;
    return null;
  }

  async open(onClose: () => void): Promise<PipOverlayHandle> {
    if (this.currentHandle?.isOpen()) {
      this.currentHandle.close();
      this.currentHandle = null;
    }
    this.currentHandle = await this.pip.open({
      onClose: () => {
        this.currentHandle = null;
        onClose();
      },
    });
    return this.currentHandle;
  }

  close(): void {
    if (this.currentHandle?.isOpen()) {
      this.currentHandle.close();
    }
    this.currentHandle = null;
  }
}
