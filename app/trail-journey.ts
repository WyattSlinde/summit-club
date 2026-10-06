/** Every phase is a reversible function of scroll, including the hold at the peak. */
export const WALK_END = .50;
export const DESCENT_START = .69;
export const CLUB_START = .995;
// Nearly six screens of walking, a two-screen summit rise, then an unhurried arrival.
export const JOURNEY_VIEWPORTS = 11.6;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
export function trailJourney(scrollProgress: number, reducedMotion = false) {
  const progress = clamp(scrollProgress);
  const walk = reducedMotion ? 1 : clamp(progress / WALK_END);
  const rise = reducedMotion ? 1 : ease(.505, .665, progress);
  const descent = reducedMotion ? 1 : ease(DESCENT_START, .90, progress);
  const approach = reducedMotion ? 1 : ease(.925, 1, progress);
  return {
    progress, walk, rise, descent, approach,
    intro: reducedMotion ? 0 : 1 - ease(.025, .10, progress),
    title: reducedMotion ? 1 : ease(.50, .515, progress) * (1 - ease(.71, .785, progress)),
    titleY: reducedMotion ? 0 : (1 - rise) * 70 - ease(.69, .81, progress) * 36,
    invitation: reducedMotion ? 1 : ease(.63, .668, progress) * (1 - ease(.70, .76, progress)),
    foreground: reducedMotion ? 0 : ease(.494, .50, progress) * (1 - ease(.69, .715, progress)),
    controls: reducedMotion ? 0 : 1 - ease(.46, .50, progress),
    camp: reducedMotion ? 1 : ease(.905, .94, progress),
    cover: reducedMotion ? -15 : 112 - approach * 130,
    shade: .06,
    accessible: reducedMotion || progress >= CLUB_START,
    navigation: reducedMotion || progress >= CLUB_START,
    phase: reducedMotion ? 'summit' : progress >= CLUB_START ? 'revealed' : progress >= DESCENT_START ? 'descending' : progress >= WALK_END ? 'summit' : progress > .10 ? 'climbing' : 'opening',
  } as const;
}
/** Start moving with the first scroll; brake only in the final 3.5% of a leg. */
const cameraTravel = (value: number) => {
  const t = clamp(value), braking = .035, normalization = 1 - braking / 2;
  if (t <= 1 - braking) return t / normalization;
  const tail = t - (1 - braking);
  return (1 - braking + tail - tail * tail / (2 * braking)) / normalization;
};
export function framePositionForProgress(scrollProgress: number, frameCount: number, summitFrame = Math.round((frameCount - 1) * .6)) {
  const p = clamp(scrollProgress), last = Math.max(0, frameCount - 1), summit = Math.max(0, Math.min(last, summitFrame));
  if (p <= WALK_END) return cameraTravel(p / WALK_END) * summit;
  if (p <= DESCENT_START) return summit;
  return summit + cameraTravel((p - DESCENT_START) / (.90 - DESCENT_START)) * (last - summit);
}
export function frameForProgress(scrollProgress: number, frameCount: number, summitFrame = Math.round((frameCount - 1) * .6)) {
  return Math.round(framePositionForProgress(scrollProgress, frameCount, summitFrame));
}
/** Ordered priorities favor the current frame and the direction of travel. */
export function frameWindow(frame: number, count: number, direction = 1, radius = 10) {
  const order = [frame];
  for (let distance = 1; distance <= radius; distance++) order.push(frame + distance * direction, frame - distance * direction);
  return order.filter(index => index >= 0 && index < count);
}

/** Keep a reader at the same club content when the animated runway changes. */
export function reflowScroll(scroll: number, start: number, oldRunway: number, newRunway: number, oldHeight: number, newHeight: number, wasSimple: boolean, isSimple: boolean) {
  const oldClub = start + (wasSimple ? oldHeight : oldRunway);
  const newClub = start + (isSimple ? newHeight : newRunway);
  if (scroll >= oldClub - 2) return newClub + Math.max(0, scroll - oldClub);
  const progress = wasSimple ? 0 : clamp((scroll - start) / Math.max(1, oldRunway));
  if (isSimple) return progress > .12 ? newClub : start;
  return start + progress * newRunway;
}

/** Respect Retina displays without allocating an unbounded full-screen canvas. */
export function canvasResolution(width: number, height: number, pixelRatio: number) {
  const w = Math.max(1, width), h = Math.max(1, height);
  const ratio = Math.min(Math.max(1, pixelRatio || 1), 2, Math.sqrt(8500000 / (w * h)));
  return { width: Math.round(w * ratio), height: Math.round(h * ratio) };
}

/** Start on the deer beside the trail, then settle on the path as the visitor climbs. */
export function frameFocalX(frame: number, fps: number) {
  const t = clamp(frame / Math.max(1, fps * 3));
  return .5 * t * t * (3 - 2 * t);
}
