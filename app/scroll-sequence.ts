import { frameWindow } from './trail-journey.ts';

type Options = {
  count: number;
  url: (frame: number) => string;
  /** Small images of the identical camera poses, used while the visitor scrolls. */
  previewUrl?: (frame: number) => string;
  onFrame: (image: ImageBitmap, frame: number, nextImage?: ImageBitmap, mix?: number) => void;
  onError: () => void;
  loadPreview?: (frame:number, signal:AbortSignal, priority:'high'|'low') => Promise<Blob>;
  maxDecoded?: number;
  maxPreviewDecoded?: number;
};
type Layer = 'motion' | 'detail';
type Request = { frame: number; layer: Layer; controller: AbortController };
type Decode = { frame: number; layer: Layer };
type Cache = {
  images: Map<number, ImageBitmap>;
  blobs: Map<number, Blob>;
  failed: Set<number>;
};
const cache = (): Cache => ({ images: new Map(), blobs: new Map(), failed: new Set() });
const key = (layer: Layer, frame: number) => `${layer}:${frame}`;

/** Scroll chooses the pose. Async work may only finish that pose or sharpen it. */
export class ScrollSequence {
  private motion = cache();
  private detail = cache();
  private requests = new Map<string, Request>();
  private decoding = new Map<string, Decode>();
  private wanted = 0;
  private position = 0;
  private shown = -1;
  private shownImage: ImageBitmap | undefined;
  private shownNext: ImageBitmap | undefined;
  private shownMix = 0;
  private direction = 1;
  private started = false;
  private stopped = false;
  private reportedError = false;
  private detailWanted: number[] = [];
  private detailTimer: ReturnType<typeof setTimeout> | undefined;
  private maxMotion: number;
  private maxDetail: number;
  private decodeRadius: number;
  private fetchRadius: number;
  private options: Options;

  constructor(options: Options) {
    this.options = options;
    this.maxMotion = Math.max(4, options.previewUrl ? options.maxPreviewDecoded ?? 32 : options.maxDecoded ?? 32);
    this.maxDetail = Math.max(1, options.maxDecoded ?? 3);
    this.decodeRadius = Math.min(options.previewUrl ? 24 : 10, Math.floor((this.maxMotion - 2) / 2));
    this.fetchRadius = Math.max(12, Math.min(48, this.decodeRadius * 2));
  }

  seek(frame: number) {
    if (this.stopped) return;
    const position = Math.min(Math.max(0, this.options.count - 1), Math.max(0, Number.isFinite(frame) ? frame : 0));
    const next = Math.floor(position);
    if (this.started && position === this.position) return;
    const sameWindow = this.started && next === this.wanted;
    this.position = position;
    if (next !== this.wanted) this.direction = next > this.wanted ? 1 : -1;
    this.started = true;
    this.wanted = next;
    clearTimeout(this.detailTimer);
    this.detailWanted = [];

    // The closest cached pose moves immediately with input. Never overshoot the
    // requested pose or let a neighbor finishing its download move the camera.
    this.paintCached();
    if (!sameWindow) { this.cancelObsoleteRequests(); this.trim(); }
    if (this.motion.failed.has(next)) this.motionFailure(next);
    if (this.options.previewUrl && !this.detailWanted.length) {
      this.detailTimer = setTimeout(() => {
        if (this.stopped || this.wanted !== next) return;
        this.detailWanted = [...new Set([next, Math.ceil(this.position)])];
        this.pump();
      }, 100);
    }
    this.pump();
  }

  private paintCached() {
    if (this.present(this.wanted)) return;
    if (this.shown < 0) return;
    const low = Math.min(this.shown, this.wanted), high = Math.max(this.shown, this.wanted);
    const candidates = [...this.motion.images.keys(), ...this.detail.images.keys()].filter(index => index >= low && index <= high);
    candidates.sort((a, b) => Math.abs(a - this.wanted) - Math.abs(b - this.wanted));
    if (candidates.length) this.present(candidates[0]);
  }

  private present(index: number) {
    const image = this.detail.images.get(index) ?? this.motion.images.get(index);
    if (this.stopped || !image) return false;
    const fraction = index === this.wanted ? this.position - index : 0;
    const nextImage = fraction > 0 ? this.detail.images.get(index + 1) ?? this.motion.images.get(index + 1) : undefined;
    const mix = nextImage ? fraction : 0;
    if (image === this.shownImage && index === this.shown && nextImage === this.shownNext && mix === this.shownMix) return true;
    this.shown = index;
    this.shownImage = image;
    this.shownNext = nextImage;
    this.shownMix = mix;
    this.options.onFrame(image, index, nextImage, mix);
    return true;
  }

  private cancelRequest(id: string, request: Request) {
    // Free the network slot immediately, even if a transport settles abort late.
    this.requests.delete(id);
    request.controller.abort();
  }

  private cancelObsoleteRequests() {
    for (const [id, request] of this.requests) {
      if (request.layer === 'detail' || Math.abs(request.frame - this.wanted) > this.fetchRadius) this.cancelRequest(id, request);
    }
    // A current-frame request must never wait behind four speculative downloads.
    const wanted = key('motion', this.wanted);
    if (!this.motion.images.has(this.wanted) && !this.motion.blobs.has(this.wanted) && !this.requests.has(wanted)) {
      const speculative = [...this.requests].filter(([, request]) => request.layer === 'motion')
        .sort((a, b) => Math.abs(b[1].frame - this.wanted) - Math.abs(a[1].frame - this.wanted));
      if (speculative.length >= 4) this.cancelRequest(...speculative[0]);
    }
  }

  private pump() {
    if (this.stopped || !this.started) return;
    const priorities = frameWindow(this.wanted, this.options.count, this.direction, this.decodeRadius);
    const compressed = frameWindow(this.wanted, this.options.count, this.direction, this.fetchRadius);
    const needsFetch = (layer: Layer, frame: number) => {
      const stored = this[layer];
      return !stored.images.has(frame) && !stored.blobs.has(frame) && !stored.failed.has(frame) && !this.requests.has(key(layer, frame));
    };
    for (const index of compressed) {
      if ([...this.requests.values()].filter(request => request.layer === 'motion').length >= 4) break;
      if (needsFetch('motion', index)) this.fetchFrame('motion', index);
    }
    for (const index of this.detailWanted) if (needsFetch('detail', index)) this.fetchFrame('detail', index);

    const decodeOrder: Decode[] = [{ layer: 'motion', frame: this.wanted }];
    if (this.position > this.wanted) decodeOrder.push({ layer: 'motion', frame: this.wanted + 1 });
    decodeOrder.push(...this.detailWanted.map(frame => ({ layer: 'detail' as const, frame })));
    decodeOrder.push(...priorities.slice(1).map(frame => ({ layer: 'motion' as const, frame })));
    for (const job of decodeOrder) {
      if (this.decoding.size >= 2) break;
      const stored = this[job.layer], id = key(job.layer, job.frame);
      if (stored.images.has(job.frame) || !stored.blobs.has(job.frame) || stored.failed.has(job.frame) || this.decoding.has(id)) continue;
      // Reserve a decoder for the requested pose while its bytes are arriving.
      const waitingForPose = !this.motion.images.has(this.wanted) && !this.detail.images.has(this.wanted)
        && !this.decoding.has(key('motion', this.wanted)) && !this.decoding.has(key('detail', this.wanted));
      if (waitingForPose && job.frame !== this.wanted && this.decoding.size >= 1) continue;
      this.decoding.set(id, job);
      void this.decodeFrame(job, stored.blobs.get(job.frame)!);
    }
  }

  private fetchFrame(layer: Layer, frame: number) {
    const id = key(layer, frame), request = { layer, frame, controller: new AbortController() };
    this.requests.set(id, request);
    void this.load(request, id);
  }

  private async load(request: Request, id: string) {
    const { layer, frame, controller } = request;
    try {
      const url = layer === 'motion' ? this.options.previewUrl ?? this.options.url : this.options.url;
      const signal = AbortSignal.any([controller.signal, AbortSignal.timeout(12000)]);
      const priority = frame === this.wanted && layer === 'motion' ? 'high' : 'low';
      let blob:Blob;
      if(layer==='motion' && this.options.loadPreview)blob=await this.options.loadPreview(frame,signal,priority);
      else {
        const response = await fetch(url(frame), { signal, cache:'force-cache', priority } as RequestInit & {priority:'high'|'low'});
        if(!response.ok)throw new Error(`Frame ${frame}: ${response.status}`);
        blob=await response.blob();
      }
      if (this.stopped || controller.signal.aborted || this.requests.get(id) !== request) return;
      this[layer].blobs.set(frame, blob);
      this.trim();
    } catch {
      if (!this.stopped && !controller.signal.aborted && this.requests.get(id) === request) {
        this[layer].failed.add(frame);
        if (layer === 'motion') this.motionFailure(frame);
        else if (frame === this.wanted && this.motion.failed.has(frame)) this.error();
      }
    } finally {
      if (this.requests.get(id) === request) this.requests.delete(id);
      this.pump();
    }
  }

  private async decodeFrame(job: Decode, blob: Blob) {
    const { layer, frame } = job, id = key(layer, frame);
    try {
      const image = await createImageBitmap(blob);
      const relevant = layer === 'motion' ? Math.abs(frame - this.wanted) <= this.decodeRadius : frame === this.wanted || frame === Math.ceil(this.position);
      if (this.stopped || !relevant) { image.close(); return; }
      this[layer].images.set(frame, image);
      // Complete only the latest scroll request; out-of-order neighbors stay cached.
      if (frame === this.wanted || (this.position > this.wanted && frame === this.wanted + 1)) this.present(this.wanted);
      this.trim();
    } catch {
      if (!this.stopped) {
        this[layer].failed.add(frame);
        if (layer === 'motion') this.motionFailure(frame);
        else if (frame === this.wanted && this.motion.failed.has(frame)) this.error();
      }
    } finally {
      if (this.decoding.get(id) === job) this.decoding.delete(id);
      this.pump();
    }
  }

  private motionFailure(frame: number) {
    if (frame !== this.wanted) return;
    if (this.options.previewUrl && !this.detail.failed.has(frame)) this.detailWanted = [frame];
    else this.error();
  }

  private error() {
    if (this.stopped || this.reportedError) return;
    this.reportedError = true;
    this.options.onError();
  }

  private trim() {
    for (const layer of ['motion', 'detail'] as const) {
      const stored = this[layer], maxImages = layer === 'motion' ? this.maxMotion : this.maxDetail;
      const imageOrder = [...stored.images.keys()].filter(index => stored.images.get(index) !== this.shownImage && stored.images.get(index) !== this.shownNext)
        .sort((a, b) => Math.abs(b - this.wanted) - Math.abs(a - this.wanted));
      while (stored.images.size > maxImages && imageOrder.length) {
        const index = imageOrder.shift()!;
        stored.images.get(index)?.close();
        stored.images.delete(index);
      }
      const maxBlobs = layer === 'motion' ? Math.max(96, this.maxMotion * 4) : Math.max(4, this.maxDetail * 2);
      const blobOrder = [...stored.blobs.keys()].sort((a, b) => Math.abs(b - this.wanted) - Math.abs(a - this.wanted));
      while (stored.blobs.size > maxBlobs) stored.blobs.delete(blobOrder.shift()!);
    }
  }

  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    clearTimeout(this.detailTimer);
    for (const [id, request] of this.requests) this.cancelRequest(id, request);
    for (const stored of [this.motion, this.detail]) {
      stored.images.forEach(image => image.close());
      stored.images.clear(); stored.blobs.clear(); stored.failed.clear();
    }
    this.shownImage = undefined;
    this.shownNext = undefined;
  }
}
