/** Scroll is the only clock. There is no media playback or time-based camera. */
export const WALK_END = .76;
export const CLUB_START = .985;
export const JOURNEY_VIEWPORTS = 3.4;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};
export function trailJourney(scrollProgress: number, reducedMotion = false) {
  const progress = clamp(scrollProgress);
  const walk = reducedMotion ? 1 : clamp(progress / WALK_END);
  return {
    progress, walk,
    intro: reducedMotion ? 0 : 1 - ease(.025, .10, progress),
    title: reducedMotion ? 1 : ease(.75, .82, progress) * (1 - ease(.90, .99, progress)),
    controls: reducedMotion ? 0 : 1 - ease(.76, .83, progress),
    camp: reducedMotion ? 1 : ease(.95, 1, progress),
    shade: reducedMotion ? .18 : .03 + ease(.84, 1, progress) * .19,
    accessible: reducedMotion || progress >= CLUB_START,
    navigation: reducedMotion || progress >= CLUB_START,
    phase: reducedMotion ? 'summit' : progress >= CLUB_START ? 'revealed' : progress >= .76 ? 'summit' : progress > .10 ? 'climbing' : 'opening',
  } as const;
}
export function frameForProgress(scrollProgress: number, frameCount: number) {
  return Math.round(trailJourney(scrollProgress).walk * Math.max(0, frameCount - 1));
}
/** Ordered priorities favor the current frame and the direction of travel. */
export function frameWindow(frame: number, count: number, direction = 1, radius = 10) {
  const order = [frame];
  for (let distance = 1; distance <= radius; distance++) order.push(frame + distance * direction, frame - distance * direction);
  return order.filter(index => index >= 0 && index < count);
}
