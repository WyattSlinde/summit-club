/** The visitor's scroll position is the only clock for walking and the reveal. */
export const WALK_END = .70;
export const CLUB_START = .94;
export const JOURNEY_VIEWPORTS = 3.05;
const clamp = (value: number) => Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
const ease = (from: number, to: number, value: number) => {
  const t = clamp((value - from) / (to - from));
  return t * t * (3 - 2 * t);
};

export function trailJourney(scrollProgress: number, reducedMotion = false) {
  const progress = clamp(scrollProgress);
  const walk = reducedMotion ? 1 : clamp(progress / WALK_END);
  return {
    progress,
    walk,
    z: 620 - walk * 1810,
    // Let the visitor finish looking around before introducing the club page.
    lookFreedom: reducedMotion ? 0 : 1 - ease(.78, .93, progress),
    intro: reducedMotion ? 0 : 1 - ease(.035, .105, progress),
    title: reducedMotion ? 1 : ease(.70, .76, progress) * (1 - ease(.82, .91, progress)),
    controls: reducedMotion ? 0 : 1 - ease(.75, .84, progress),
    camp: reducedMotion ? 1 : ease(.90, 1, progress),
    shade: reducedMotion ? .38 : .10 + ease(.82, 1, progress) * .56,
    accessible: reducedMotion || progress >= CLUB_START,
    navigation: reducedMotion || progress >= .91,
    exploring: !reducedMotion && progress < .84,
    phase: reducedMotion ? 'summit' : progress >= .94 ? 'revealed' : progress >= .76 ? 'summit' : progress > .10 ? 'climbing' : 'opening',
  } as const;
}

export function walkerEyeHeight(ground: number, walk: number, reducedMotion = false) {
  const step = clamp(walk);
  const bob = reducedMotion ? 0 : Math.sin(step * 94) * (1 - ease(.92, 1, step)) * .035;
  return ground + 1.78 + bob;
}
