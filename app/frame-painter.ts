/** Decode completions can arrive together. Paint only their latest result once
 * per animation frame; never run a playback loop or retain an obsolete pose. */
export class FramePainter<T> {
  private pending: T | undefined;
  private scheduled: number | undefined;
  private disposed = false;
  private paint: (value: T) => void;
  private request: (callback: FrameRequestCallback) => number;
  private cancel: (id: number) => void;
  constructor(paint: (value: T) => void,
    request: (callback: FrameRequestCallback) => number = requestAnimationFrame,
    cancel: (id: number) => void = cancelAnimationFrame) {
    this.paint = paint; this.request = request; this.cancel = cancel;
  }
  queue(value: T) {
    if (this.disposed) return;
    this.pending = value;
    if (this.scheduled === undefined) this.scheduled = this.request(() => {
      this.scheduled = undefined; this.flush();
    });
  }
  /** The scroll handler already runs in rAF, so it can paint without one frame of lag. */
  flush() {
    if (this.disposed) return;
    if (this.scheduled !== undefined) { this.cancel(this.scheduled); this.scheduled = undefined; }
    const value = this.pending; this.pending = undefined;
    if (value !== undefined) this.paint(value);
  }
  dispose() {
    this.disposed = true;
    if (this.scheduled !== undefined) this.cancel(this.scheduled);
    this.scheduled = undefined; this.pending = undefined;
  }
}
