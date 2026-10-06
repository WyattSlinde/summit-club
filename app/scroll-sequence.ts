import { frameWindow } from './trail-journey.ts';
type Options = {
  count: number;
  url: (frame: number) => string;
  onFrame: (image: ImageBitmap, frame: number) => void;
  onError: () => void;
  maxDecoded?: number;
};
/** Bounded decoded-image cache. Scroll/resize/load events are the only paint triggers. */
export class ScrollSequence {
  private blobs = new Map<number, Blob>();
  private images = new Map<number, ImageBitmap>();
  private failed = new Set<number>();
  private inFlight = new Set<number>();
  private controller = new AbortController();
  private wanted = 0;
  private shown = -1;
  private direction = 1;
  private stopped = false;
  private cursor = 0;
  private maxDecoded: number;
  private options: Options;
  constructor(options: Options) { this.options = options; this.maxDecoded = options.maxDecoded ?? 32; }
  seek(frame: number) {
    if (this.stopped) return;
    const next = Math.min(this.options.count - 1, Math.max(0, Math.round(frame)));
    if (next !== this.wanted) this.direction = next > this.wanted ? 1 : -1;
    this.wanted = next;
    if (this.failed.has(next)) { this.options.onError(); return; }
    this.paint(); this.pump();
  }
  private paint() {
    if (this.stopped || !this.images.has(this.wanted)) return;
    this.shown = this.wanted;
    this.options.onFrame(this.images.get(this.wanted)!, this.wanted);
  }
  private pump() {
    if (this.stopped) return;
    const priorities = frameWindow(this.wanted, this.options.count, this.direction, 10);
    while (this.inFlight.size < 4) {
      let index = priorities.find(i => !this.images.has(i) && !this.inFlight.has(i) && !this.failed.has(i));
      // Prefetch compressed frames; distant frames stay undecoded.
      if (index === undefined) {
        for (let scanned = 0; scanned < this.options.count; scanned++) {
          const i = this.cursor++ % this.options.count;
          if (!this.blobs.has(i) && !this.inFlight.has(i) && !this.failed.has(i)) { index = i; break; }
        }
      }
      if (index === undefined) break;
      this.inFlight.add(index);
      void this.load(index);
    }
  }
  private async load(index: number) {
    try {
      let blob = this.blobs.get(index);
      if (!blob) {
        const signal = AbortSignal.any([this.controller.signal, AbortSignal.timeout(12000)]);
        const response = await fetch(this.options.url(index), { signal, cache: 'force-cache' });
        if (!response.ok) throw new Error(`Frame ${index}: ${response.status}`);
        blob = await response.blob();
        if (this.stopped) return;
        this.blobs.set(index, blob);
      }
      if (Math.abs(index - this.wanted) <= 10) {
        const image = await createImageBitmap(blob);
        if (this.stopped) { image.close(); return; }
        this.images.set(index, image);
        this.paint();
        // Pin the last displayed bitmap until its replacement is available (resize may redraw it).
        const farthest = [...this.images.keys()].filter(i => i !== this.shown).sort((a, b) => Math.abs(b - this.wanted) - Math.abs(a - this.wanted));
        while (this.images.size > this.maxDecoded) {
          const evicted = farthest.shift()!;
          this.images.get(evicted)?.close(); this.images.delete(evicted);
        }
      }
    } catch {
      if (!this.stopped) {
        this.failed.add(index);
        if (index === this.wanted || this.failed.size >= 8) this.options.onError();
      }
    } finally { this.inFlight.delete(index); this.pump(); }
  }
  dispose() {
    this.stopped = true; this.controller.abort();
    this.images.forEach(image => image.close());
    this.images.clear(); this.blobs.clear();
  }
}
