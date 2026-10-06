const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
function noise(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
  const sx = u * u * (3 - 2 * u), sy = v * v * (3 - 2 * v);
  return mix(mix(hash(ix, iy), hash(ix + 1, iy), sx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy) * 2 - 1;
}
const fractal = (x: number, z: number) => noise(x, z) * .55 + noise(x * 2.03 + 21, z * 2.03 - 31) * .27 + noise(x * 4.17 - 7, z * 4.17 + 53) * .13 + noise(x * 8.37 + 41, z * 8.37 - 13) * .05;
export const trailX = (z: number) => Math.sin(z * .0041 + .3) * 155 + Math.sin(z * .0076) * 24 + Math.sin(z * .025 + .4) * 3.8;
export const trailHeight = (z: number) => 28 + clamp((650 - z) / 2100) * 245 + Math.sin(z * .0017) * 18 + noise(z * .002, 12) * 4 + Math.sin(z * .029) * .65 + noise(z * .011, 7) * 1.1;
export const trailHalfWidth = (z: number) => 1.12 + noise(z * .045, 27) * .26 + noise(z * .14, 39) * .09 + Math.sin(z * .019) * .12;
export const creekX = (z: number) => trailX(z) + 13 + Math.sin(z * .018 + 1.7) * 2.2 + noise(z * .055, 43) * 1.1;
export const creekWindow = (z: number) => smooth(405, 445, z) * (1 - smooth(660, 700, z));
export const creekHalfWidth = (z: number) => .62 + noise(z * .085, 81) * .17 + Math.sin(z * .024) * .12;
const hill = (x: number, z: number, cx: number, cz: number, sx: number, sz: number) => Math.exp(-(((x - cx) / sx) ** 2 + ((z - cz) / sz) ** 2));

function groundWithoutCreek(x: number, z: number) {
  const offset = x - trailX(z), distance = Math.abs(offset);
  const wx = x + noise(x * .0011 + 20, z * .0011) * 210;
  const wz = z + noise(x * .0011, z * .0011 + 40) * 190;
  // Broad overlapping masses avoid the repeated, pointed "cone mountain" silhouette.
  // The wooded foothills are low; the alpine range begins well beyond the walk.
  const west = hill(wx, wz, -1480, -4250, 1400, 2750) * 960;
  const east = hill(wx, wz, 1720, -4680, 1670, 2850) * 1240;
  const headwall = hill(wx, wz, -180, -6170, 2490, 1430) * 1080;
  const ridge = Math.max(west, east, headwall) + Math.min(west, east) * .15;
  const foothills = hill(wx, wz, -620, -430, 560, 1320) * 116 + hill(wx, wz, 820, -780, 790, 1670) * 148;
  const fractures = fractal(wx * .0038, wz * .0031);
  const rocky = 68 + clamp((450 - z) / 4900) * 145 + ridge * (.89 + fractures * .19) + foothills + fractal(wx * .0014, wz * .0017) * 72 + fractures * 30;
  const opening = Math.exp(-(((z - 595) / 260) ** 2));
  const valley = smooth(6.5, 300 + opening * 140, distance), corridorEnd = smooth(1650, 3100, -z);
  const valleyBlend = mix(valley, 1, corridorEnd);
  const nearBank = smooth(2.5, 13, distance) * (1 - smooth(105, 220, distance)) * (1 - corridorEnd);
  const rolls = noise(x * .029 + 19, z * .024) * 1.25 + noise(x * .093, z * .077) * .27;
  const shoulder = .19 + .21 * Math.sin(z * .016 + (offset > 0 ? 1.4 : 3.1));
  const entryBank = opening * Math.exp(-(((distance - 24) / 19) ** 2)) * smooth(5, 13, distance) * (offset > 0 ? .5 : 1.35);
  const meadowHollow = opening * Math.exp(-(((offset - 14) / 12) ** 2)) * .65;
  const ledges = Math.pow(Math.max(0, noise(x * .036 - 71, z * .041 + 9)), 2) * 1.3;
  const footbed = Math.pow(Math.min(distance / 2.1, 1), 2) * .12 + noise(x * .65, z * .24) * .028;
  return mix(trailHeight(z), rocky, valleyBlend) + nearBank * (rolls + shoulder + ledges + entryBank - meadowHollow) + footbed * (1 - valleyBlend);
}

export function terrainHeight(x: number, z: number) {
  const ground = groundWithoutCreek(x, z), window = creekWindow(z);
  if (!window) return ground;
  const center = creekX(z), distance = Math.abs(x - center);
  const width = creekHalfWidth(z);
  if (distance >= width + 1.35) return ground;
  const bed = groundWithoutCreek(center, z) - .39 + Math.pow(Math.min(distance / (width + .25), 1), 2) * .30;
  return mix(ground, bed, (1 - smooth(width * .7, width + 1.35, distance)) * window);
}

export const creekSurface = (z: number) => groundWithoutCreek(creekX(z), z) - .235 * creekWindow(z);

export function terrainColumns(mobile: boolean) {
  const columns: number[] = [];
  for (let x = 0; x <= 24; x += mobile ? 1 : .65) columns.push(x);
  for (let x = 26; x <= 70; x += 2) columns.push(x);
  for (let x = 74; x <= 180; x += mobile ? 6 : 5) columns.push(x);
  for (let x = 192; x <= 680; x += 32) columns.push(x);
  for (let x = 720; x <= 5750; x += 160) columns.push(x);
  return columns;
}

/** Dense samples under the walker, progressively coarser only in the distant range. */
export function terrainRows(mobile: boolean) {
  const rows: number[] = [];
  for (let z = 1050; z >= -1600; z -= z > 350 && z < 750 ? (mobile ? 3 : 2) : (mobile ? 7 : 4)) rows.push(z);
  for (let z = -1625; z >= -7800; z -= 45) rows.push(z);
  return rows;
}
