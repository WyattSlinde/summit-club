export const BRAND_DURATION = 4200;
export const BRAND_FRAMES = 24;
export const BRAND_COLUMNS = 4;
export const BRAND_TILE = { width: 768, height: 432 };

/** A single reversible pose for the forest texture, sunlight, pines, and trail. */
export function brandPose(value: number) {
  const progress = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 1));
  const frame = Math.min(BRAND_FRAMES - 1, Math.floor(progress * BRAND_FRAMES));
  const rise = 1 - Math.pow(1 - progress, 3);
  return {
    '--brand-frame-x': `${-(frame % BRAND_COLUMNS) * BRAND_TILE.width}px`,
    '--brand-frame-y': `${-Math.floor(frame / BRAND_COLUMNS) * BRAND_TILE.height}px`,
    '--brand-sun-y': `${((1 - rise) * 11).toFixed(3)}px`,
    '--brand-grow': (.55 + rise * .45).toFixed(4),
    '--brand-wind': `${(Math.sin(progress * Math.PI * 4) * 2.5 * Math.sin(progress * Math.PI)).toFixed(3)}deg`,
    '--brand-trail': (1 - rise).toFixed(4),
    '--brand-light-x': `${(-200 + rise * 830).toFixed(3)}px`,
  };
}

export function paintBrandPose(element: HTMLElement | SVGElement, progress: number) {
  for (const [name, value] of Object.entries(brandPose(progress))) element.style.setProperty(name, value);
}
