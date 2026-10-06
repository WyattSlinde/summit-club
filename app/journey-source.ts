type Media = {
  frameCount: number; summitFrame: number; path: string; motionPath: string;
  revealPath?: string; revealMotionPath?: string; version: string;
};
/** Keep the approved climb byte-for-byte; only the frames beyond its peak change. */
export function journeyFrameUrl(media: Media, index: number, portrait: boolean, preview = false) {
  const frame = Math.max(0, Math.min(media.frameCount - 1, Math.round(Number.isFinite(index) ? index : 0)));
  const reveal = frame > media.summitFrame;
  const root = preview ? (reveal && media.revealMotionPath || media.motionPath) : (reveal && media.revealPath || media.path);
  return `${root}/${portrait ? 'mobile' : 'desktop'}/${String(frame).padStart(4, '0')}.webp?v=${media.version}`;
}
