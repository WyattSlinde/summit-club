/** Every phase is a reversible function of scroll, including the hold at the peak. */
export const WALK_END = .52;
export const DESCENT_START = .69;
export const CLUB_START = .963;
export const JOURNEY_VIEWPORTS = 4.2;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
export function trailJourney(scrollProgress: number, reducedMotion = false) {
  const progress = clamp(scrollProgress);
  const walk = reducedMotion ? 1 : clamp(progress / WALK_END);
  const rise = reducedMotion ? 1 : ease(.53, .63, progress);
  const descent = reducedMotion ? 1 : ease(DESCENT_START, .90, progress);
  const approach = reducedMotion ? 1 : ease(.79, 1, progress);
  return {
    progress, walk, rise, descent, approach,
    intro: reducedMotion ? 0 : 1 - ease(.025, .10, progress),
    title: reducedMotion ? 1 : ease(.52, .545, progress) * (1 - ease(.71, .80, progress)),
    titleY: reducedMotion ? 0 : (1 - rise) * 48 - ease(.69, .81, progress) * 36,
    foreground: reducedMotion ? 0 : ease(.512, .52, progress) * (1 - ease(.69, .715, progress)),
    controls: reducedMotion ? 0 : 1 - ease(.46, .52, progress),
    camp: reducedMotion ? 1 : ease(.775, .80, progress),
    cover: reducedMotion ? -15 : 112 - approach * 130,
    shade: .06,
    accessible: reducedMotion || progress >= CLUB_START,
    navigation: reducedMotion || progress >= CLUB_START,
    phase: reducedMotion ? 'summit' : progress >= CLUB_START ? 'revealed' : progress >= DESCENT_START ? 'descending' : progress >= WALK_END ? 'summit' : progress > .10 ? 'climbing' : 'opening',
  } as const;
}
export function frameForProgress(scrollProgress: number, frameCount: number, summitFrame = Math.round((frameCount - 1) * .6)) {
  const p = clamp(scrollProgress), last = Math.max(0, frameCount - 1), summit = Math.max(0, Math.min(last, summitFrame));
  if (p <= WALK_END) return Math.round(p / WALK_END * summit);
  if (p <= DESCENT_START) return summit;
  return Math.round(summit + clamp((p - DESCENT_START) / (.90 - DESCENT_START)) * (last - summit));
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
