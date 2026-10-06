import type * as Three from 'three';
import { creekX } from './trail-terrain';

type Options = {
  mobile: boolean;
  left: Three.Group;
  right: Three.Group;
  terrainHeight: (x: number, z: number) => number;
  trailX: (z: number) => number;
  resources: Set<Three.BufferGeometry | Three.Material | Three.Texture>;
  isDisposed: () => boolean;
  onReady: () => void;
};
type Tree = { x: number; y: number; z: number; height: number; width: number; yaw: number; lean: number; variant: number; level: number; seed: number };
type Limb = [Three.Vector3, Three.Vector3, number, number?];
const random = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** Mixed-age groves, with detailed near trees and inexpensive distant crowns. */
export function addTrailForest(T: typeof import('three'), options: Options) {
  const { mobile, left, right, terrainHeight, trailX, resources, isDisposed, onReady } = options;
  const keep = <V extends Three.BufferGeometry | Three.Material | Three.Texture>(value: V): V => { resources.add(value); return value; };
  const wind = { value: 0 }, color = new T.Color(), dummy = new T.Object3D();
  function texture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d'); if (ctx) draw(ctx);
    const result = keep(new T.CanvasTexture(canvas)); result.colorSpace = T.SRGBColorSpace; result.anisotropy = 8; return result;
  }
  function foliageWind(material: Three.MeshStandardMaterial, leafy = false) {
    material.onBeforeCompile = shader => {
      shader.uniforms.forestTime = wind;
      shader.vertexShader = 'uniform float forestTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float treeSeed = instanceMatrix[3].x * .051 + instanceMatrix[3].z * .014;
        float flex = pow(max(position.y, 0.), 1.8);
        transformed.x += (sin(forestTime * .40 + treeSeed) * .0055 + sin(forestTime * 1.8 + treeSeed + position.x * 65.) * ${leafy ? '.0016' : '.0007'}) * flex;
        transformed.z += cos(forestTime * .29 + treeSeed * 1.3) * .004 * flex;
      `);
      // Keep the photographic needle colour. Strong green gain and emission
      // erased all the shading between the former, oversized foliage cards.
      shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * ${leafy ? '.045' : '.025'};`);
    };
    material.customProgramCacheKey = () => leafy ? 'summit-leafy-groves-v3' : 'summit-mixed-pines-v5';
  }
  const fallback = texture(128, 256, ctx => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 240; i++) {
      const y = 246 - random(i, 3) * 235, width = Math.sin(y / 256 * Math.PI) * 49, side = i % 2 ? 1 : -1;
      ctx.strokeStyle = i % 3 ? '#708344' : '#91a568'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(64, y); ctx.lineTo(64 + side * width * (.4 + random(i, 8) * .6), y - 13 - random(i, 9) * 22); ctx.stroke();
    }
  });
  const needles = keep(new T.MeshStandardMaterial({ color: 0xe6e9db, map: fallback, roughness: .98, side: T.DoubleSide, alphaTest: .34, alphaToCoverage: true, vertexColors: true })); foliageWind(needles);
  new T.TextureLoader().load('/pine-spray.webp', image => {
    if (isDisposed()) { image.dispose(); return; }
    image.colorSpace = T.SRGBColorSpace; image.anisotropy = 8; keep(image); needles.map = image; needles.needsUpdate = true; onReady();
  }, undefined, () => undefined);

  const bark = texture(256, 512, ctx => {
    ctx.fillStyle = '#766b59'; ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 2200; i++) {
      const x = random(i, 211) * 256, y = random(i, 212) * 512, w = 2 + random(i, 213) * 11, h = 7 + random(i, 214) * 37;
      ctx.fillStyle = ['#514b40', '#9d8970', '#726553', '#91816a', '#7a705d'][i % 5];
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + w * .72, y - 2); ctx.lineTo(x + w, y + h * .3); ctx.lineTo(x + w * .83, y + h); ctx.lineTo(x + w * .13, y + h + 2); ctx.lineTo(x - 1, y + h * .45); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#322e244a'; ctx.lineWidth = .65; ctx.stroke();
    }
    for (let i = 0; i < 80; i++) { ctx.fillStyle = '#949b7461'; ctx.beginPath(); ctx.ellipse(random(i, 225) * 256, random(i, 226) * 512, 2 + random(i, 227) * 5, 2 + random(i, 228) * 8, random(i, 229) * 3, 0, Math.PI * 2); ctx.fill(); }
  });
  bark.wrapS = bark.wrapT = T.RepeatWrapping; bark.repeat.set(2, 4);
  const wood = keep(new T.MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: .045, color: 0xd3cfb8, roughness: .99 }));

  function branchGeometry(limbs: Limb[], sides = 5) {
    const positions: number[] = [], uv: number[] = [], indices: number[] = [];
    for (const [from, to, radius, taper = .20] of limbs) {
      const direction = to.clone().sub(from).normalize(), cross = new T.Vector3(Math.abs(direction.y) > .95 ? 1 : 0, Math.abs(direction.y) > .95 ? 0 : 1, 0).cross(direction).normalize(), up = direction.clone().cross(cross).normalize(), base = positions.length / 3;
      for (let ring = 0; ring < 2; ring++) for (let side = 0; side < sides; side++) {
        const angle = side / sides * Math.PI * 2, point = (ring ? to : from).clone().addScaledVector(cross, Math.cos(angle) * radius * (ring ? taper : 1)).addScaledVector(up, Math.sin(angle) * radius * (ring ? taper : 1));
        positions.push(point.x, point.y, point.z); uv.push(side / sides, ring);
      }
      for (let side = 0; side < sides; side++) { const a = base + side, b = base + (side + 1) % sides; indices.push(a, b, a + sides, b, b + sides, a + sides); }
    }
    const geometry = keep(new T.BufferGeometry()); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }
  const bend = (height: number, variant: number) => Math.sin(height * 2.8 + variant) * height * height * (variant === 2 ? .030 : .013);
  function conifer(variant: number, level: number) {
    const positions: number[] = [], uv: number[] = [], colors: number[] = [], indices: number[] = [], limbs: Limb[] = [];
    const rows = level === 0 ? 2 : 1;
    function spray(center: Three.Vector3, direction: Three.Vector3, cross: Three.Vector3, length: number, width: number, seed: number, segments = rows) {
      const base = positions.length / 3;
      for (let row = 0; row <= segments; row++) {
        const t = row / segments;
        for (const edge of [-1, 1]) {
          const p = center.clone().addScaledVector(direction, t * length).addScaledVector(cross, edge * width); p.y += Math.sin(t * Math.PI) * length * .075;
          positions.push(p.x, p.y, p.z); uv.push((edge + 1) / 2, t);
          const light = .76 + t * .12 + random(seed, 53) * .16; colors.push(light * .97, light, light * .94);
        }
        if (row < segments) { const a = base + row * 2; indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
      }
    }
    const tiers = level === 0 ? (mobile ? 11 : 14) : level === 1 ? 9 : 6;
    for (let tier = 0; tier < tiers; tier++) {
      const t = tier / (tiers - 1), start = variant === 0 ? .34 : variant === 1 ? .09 : .47;
      const y = start + t * (.972 - start) + (random(tier, variant + 91) - .5) * .019;
      // A narrow conical crown, interrupted by the missing limbs of older trees.
      // Crown breadth no longer peaks beside the leader into an umbrella.
      const envelope = variant === 1 ? Math.pow(1 - t, .91) : Math.pow(1 - t, .73) * (.82 + Math.sin(t * Math.PI) * .24);
      const radius = (variant === 1 ? .19 : variant === 2 ? .175 : .153) * envelope + .005;
      const count = level === 0 ? 4 + tier % 3 : level === 1 ? 4 + tier % 2 : 3 + tier % 2;
      for (let branch = 0; branch < count; branch++) {
        const branchSeed = tier * 47 + branch * 11 + variant * 237;
        if (tier < tiers - 2 && random(branchSeed, 333) < (variant === 2 ? .25 : .13)) continue;
        const angle = branch / count * Math.PI * 2 + tier * 2.399 + variant * .67 + (random(branchSeed, 334) - .5) * .42;
        const asymmetry = variant === 2 ? .82 + .18 * Math.sin(angle + 1.3) : 1;
        const r = radius * (.69 + random(branchSeed, 29) * .46) * asymmetry;
        const radial = new T.Vector3(Math.cos(angle), 0, Math.sin(angle)), cross = new T.Vector3(-radial.z, 0, radial.x);
        const stem = new T.Vector3(bend(y, variant), y, 0);
        const knee = stem.clone().addScaledVector(radial, r * .51); knee.y -= r * (variant === 1 ? .10 : .19);
        const tip = stem.clone().addScaledVector(radial, r); tip.y += r * (.04 + t * .30);
        const limbRadius = .0038 * (1 - y) + .00055;
        if (level === 0) { limbs.push([stem, knee, limbRadius, .64], [knee, tip, limbRadius * .64, .13]); }
        const shoots = level === 0 ? (mobile ? 4 : 6) : level === 1 ? 3 : 2;
        for (let shoot = 0; shoot < shoots; shoot++) {
          const seed = branchSeed + shoot * 7, along = .34 + shoot / Math.max(1, shoots - 1) * .65;
          const junction = along < .51 ? stem.clone().lerp(knee, along / .51) : knee.clone().lerp(tip, (along - .51) / .49);
          const side = shoot % 2 ? 1 : -1;
          const direction = radial.clone().multiplyScalar(.64).addScaledVector(cross, side * (.48 + random(seed, 35) * .37)); direction.y = .20 + t * .38 + random(seed, 21) * .24; direction.normalize();
          const twigReach = r * (.16 + random(seed, 38) * .12) * Math.sin(along * Math.PI * .82);
          const twig = junction.clone().addScaledVector(direction, twigReach);
          if (level === 0 && shoot % 2 === 0 && shoot < shoots - 1) limbs.push([junction, twig, limbRadius * .30, .20]);
          // Preserve the 1:2 source-image aspect and use it as a terminal twig,
          // never stretch a single image across the full length of a bough.
          const length = Math.min(level === 2 ? .074 : level === 1 ? .057 : .043, .018 + r * .24) * (.78 + random(seed, 39) * .31);
          const across = new T.Vector3(-direction.z, (random(seed, 43) - .5) * .24, direction.x).normalize();
          spray(twig, direction, across, length, length * .245, seed);
          if (level === 0 || (level === 1 && shoot % 2 === 0)) {
            const vertical = direction.clone().cross(across).normalize();
            spray(twig.clone().addScaledVector(direction, length * .08), direction, vertical, length * .85, length * .19, seed + 100, 1);
          }
        }
        const tipDirection = radial.clone().multiplyScalar(.46); tipDirection.y = .75; tipDirection.normalize();
        const tipLength = Math.min(.037, .012 + r * .25);
        spray(tip, tipDirection, cross, tipLength, tipLength * .24, branchSeed + 400);
      }
    }
    const top = new T.Vector3(bend(.965, variant), .965, 0);
    spray(top, new T.Vector3(0, 1, 0), new T.Vector3(1, 0, 0), .055, .011, 107);
    spray(top, new T.Vector3(0, 1, 0), new T.Vector3(0, 0, 1), .054, .010, 108);
    if (level === 0 && variant !== 1) for (let i = 0; i < 7; i++) {
      const y = .10 + i * .047, angle = i * 2.47 + variant, stem = new T.Vector3(bend(y, variant), y, 0), tip = stem.clone().add(new T.Vector3(Math.cos(angle) * (.028 + random(i, 99) * .032), -.018, Math.sin(angle) * (.028 + random(i, 99) * .032))); limbs.push([stem, tip, .0023, .17]);
      if (i % 3 === 0) limbs.push([tip.clone().lerp(stem, .3), tip.clone().add(new T.Vector3(-Math.sin(angle) * .014, .007, Math.cos(angle) * .014)), .0007]);
    }
    const foliage = keep(new T.BufferGeometry()); foliage.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); foliage.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); foliage.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); foliage.setIndex(indices); foliage.computeVertexNormals(); foliage.computeBoundingSphere();
    const baseRadius = variant === 1 ? .010 : variant === 2 ? .018 : .014;
    const trunk = keep(new T.CylinderGeometry(.0017, baseRadius, .995, level === 0 ? 12 : level === 1 ? 8 : 5, level === 0 ? 15 : 5)); trunk.translate(0, .4975, 0);
    const p = trunk.getAttribute('position');
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i), angle = Math.atan2(p.getZ(i), p.getX(i));
      const flare = 1 + Math.exp(-y * 46) * .58 + Math.sin(angle * 5 + variant) * (.07 + Math.exp(-y * 28) * .11);
      p.setXYZ(i, p.getX(i) * flare + bend(y, variant), y, p.getZ(i) * flare);
    }
    trunk.computeVertexNormals();
    return { foliage, trunk, branches: level === 0 ? branchGeometry(limbs, 4) : undefined };
  }
  const conifers = Array.from({ length: 3 }, (_, variant) => Array.from({ length: 3 }, (_, level) => conifer(variant, level)));

  const leafTexture = texture(128, 160, ctx => {
    ctx.fillStyle = '#eef0ce'; ctx.beginPath(); ctx.moveTo(64, 8);
    for (let i = 1; i <= 20; i++) { const t = i / 20, y = 8 + t * 139, width = Math.pow(Math.sin(Math.PI * t), .74) * 54; ctx.lineTo(64 + width + (i % 2 ? 2 : -2), y); }
    for (let i = 19; i >= 0; i--) { const t = i / 20, y = 8 + t * 139, width = Math.pow(Math.sin(Math.PI * t), .74) * 54; ctx.lineTo(64 - width + (i % 2 ? -2 : 2), y); } ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#a7b287'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(64, 150); ctx.lineTo(64, 10); ctx.stroke();
    for (let i = 0; i < 7; i++) for (const side of [-1, 1]) { const y = 37 + i * 14; ctx.strokeStyle = '#b9c49a'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(64, y + 10); ctx.lineTo(64 + side * Math.sin((y - 8) / 139 * Math.PI) * 46, y - 5); ctx.stroke(); }
  });
  const leafy = keep(new T.MeshStandardMaterial({ color: 0xffffff, map: leafTexture, roughness: .84, side: T.DoubleSide, alphaTest: .35, alphaToCoverage: true, vertexColors: true })); foliageWind(leafy, true);
  const aspenBark = texture(256, 512, ctx => {
    ctx.fillStyle = '#d0ceba'; ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 520; i++) { const x = random(i, 611) * 256, y = random(i, 612) * 512, w = 1 + random(i, 613) * 19; ctx.fillStyle = i % 4 ? '#aaa99133' : '#e9e5d44d'; ctx.fillRect(x, y, w, 6 + random(i, 614) * 18); }
    for (let i = 0; i < 120; i++) { const x = random(i, 621) * 256, y = random(i, 622) * 512; ctx.fillStyle = i % 3 ? '#5c5d4e' : '#85836d'; ctx.beginPath(); ctx.ellipse(x, y, 2 + random(i, 624) * 9, .6 + random(i, 625) * 1.4, (random(i, 626) - .5) * .14, 0, Math.PI * 2); ctx.fill(); }
  });
  aspenBark.wrapS = aspenBark.wrapT = T.RepeatWrapping; aspenBark.repeat.set(2, 3);
  const paleWood = keep(new T.MeshStandardMaterial({ color: 0xc4c4ad, map: aspenBark, bumpMap: aspenBark, bumpScale: .012, roughness: .94 }));
  const leafPositions: number[] = [], leafUV: number[] = [], leafColors: number[] = [], leafIndices: number[] = [], aspenLimbs: Limb[] = [];
  for (let branch = 0; branch < 11; branch++) {
    const t = branch / 10, y = .35 + t * .57, angle = branch * 2.399, r = .11 + Math.sin(t * Math.PI * .9) * .12;
    const radial = new T.Vector3(Math.cos(angle), 0, Math.sin(angle)), cross = new T.Vector3(-radial.z, 0, radial.x), stem = new T.Vector3(0, y, 0), tip = stem.clone().addScaledVector(radial, r); tip.y += .10;
    aspenLimbs.push([stem, tip, .0028 * (1 - t * .7)]);
    const twigCount = mobile ? 5 : 7;
    for (let twig = 0; twig < twigCount; twig++) {
      const along = .34 + twig / twigCount * .67, junction = stem.clone().lerp(tip, along), direction = radial.clone().addScaledVector(cross, twig % 2 ? .72 : -.72).normalize(); direction.y = .42;
      const twigTip = junction.clone().addScaledVector(direction, .08); aspenLimbs.push([junction, twigTip, .00085]);
      for (let leaf = 0; leaf < 9; leaf++) {
        const seed = branch * 173 + twig * 13 + leaf, alongTwig = .08 + leaf / 9 * .95, center = junction.clone().lerp(twigTip, alongTwig).addScaledVector(cross, (leaf % 2 ? 1 : -1) * (.007 + random(seed, 645) * .014)); center.y += (random(seed, 649) - .5) * .034;
        const length = .007 + random(seed, 651) * .006, width = length * .40, axis = new T.Vector3(Math.cos(seed * 2.4), .35 + random(seed, 655), Math.sin(seed * 2.4)).normalize(), across = new T.Vector3(-axis.z, .10, axis.x).normalize(), base = leafPositions.length / 3;
        for (let row = 0; row <= 2; row++) {
          const p = row / 2;
          for (const edge of [-1, 1]) { const point = center.clone().addScaledVector(axis, (p - .5) * length).addScaledVector(across, edge * width); point.y += Math.sin(p * Math.PI) * length * .13; leafPositions.push(point.x, point.y, point.z); leafUV.push((edge + 1) / 2, p); color.setHSL(.20 + random(seed, 665) * .055, .20 + random(seed, 666) * .14, .43 + random(seed, 667) * .13); leafColors.push(color.r, color.g, color.b); }
          if (row < 2) { const a = base + row * 2; leafIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
        }
      }
    }
  }
  const aspenLeaves = keep(new T.BufferGeometry()); aspenLeaves.setAttribute('position', new T.Float32BufferAttribute(leafPositions, 3)); aspenLeaves.setAttribute('uv', new T.Float32BufferAttribute(leafUV, 2)); aspenLeaves.setAttribute('color', new T.Float32BufferAttribute(leafColors, 3)); aspenLeaves.setIndex(leafIndices); aspenLeaves.computeVertexNormals();
  const aspenTrunk = keep(new T.CylinderGeometry(.0025, .0105, .97, 8, 7)); aspenTrunk.translate(0, .485, 0); const aspenBranches = branchGeometry(aspenLimbs, 4);

  const occupancy = new Map<string, Array<[number, number, number]>>();
  const animalClearings = [[600, 7.5, 7], [610, -4.9, 6], [180, -8, 8], [-405, 6.8, 6], [-930, 9.2, 8]];
  const openingCamera = new T.Vector3(trailX(620), 0, 620);
  function allowed(x: number, z: number, height: number, spacing: number) {
    const offset = Math.abs(x - trailX(z)); if (offset < (height < 15 ? 9.4 : 11.3)) return false;
    if (z > 405 && z < 700 && Math.abs(x - creekX(z)) < 3.0) return false;
    for (const [az, ax, radius] of animalClearings) { const dx = x - trailX(az) - ax, dz = z - az; if (dx * dx + dz * dz < radius * radius) return false; }
    // Keep the first encounters legible through the nearby trunks.
    if (z > 595 && z < 620) {
      const t = (620 - z) / 20, sightX = openingCamera.x + (trailX(600) + 7.5 - openingCamera.x) * t;
      if (Math.abs(x - sightX) < 2.0) return false;
    }
    const cellX = Math.floor(x / 8), cellZ = Math.floor(z / 8);
    for (let ox = -1; ox <= 1; ox++) for (let oz = -1; oz <= 1; oz++) {
      const neighbours = occupancy.get(`${cellX + ox}:${cellZ + oz}`);
      if (neighbours) for (const [px, pz, ps] of neighbours) if ((x - px) ** 2 + (z - pz) ** 2 < Math.min(spacing, ps) ** 2) return false;
    }
    const key = `${cellX}:${cellZ}`, points = occupancy.get(key) || []; points.push([x, z, spacing]); occupancy.set(key, points); return true;
  }
  const trees: Tree[][] = [[], []], aspens: Tree[][] = [[], []], counts = [[0, 0, 0], [0, 0, 0]];
  const standsToAnimate: Array<{ canopy: Three.InstancedMesh; trunks: Three.InstancedMesh; branches?: Three.InstancedMesh; models: Array<{ foliage: Three.BufferGeometry; trunk: Three.BufferGeometry }>; baseLevel: number; level: number; x: number; z: number }> = [];
  const limits = mobile ? [95, 330, 770] : [165, 580, 1350];
  function place(side: number, z: number, offset: number, height: number, variant: number, seed: number, forceNear = false, broadleaf = false) {
    // A real clearing at the end of the footpath opens the view without lifting
    // the camera above the forest or moving whole mountain meshes aside.
    const overlook = Math.exp(-(((z + 1250) / 210) ** 2));
    if (offset < 20 + overlook * 78 && random(seed, 901) < overlook * .985) return;
    const x = trailX(z) + side * offset, y = terrainHeight(x, z);
    if (!Number.isFinite(y) || y > 1040) return;
    const slopeX = (terrainHeight(x + 3, z) - terrainHeight(x - 3, z)) / 6, slopeZ = (terrainHeight(x, z + 3) - terrainHeight(x, z - 3)) / 6;
    if (Math.hypot(slopeX, slopeZ) > (offset < 85 ? 1.35 : 1.1)) return;
    const sideIndex = side < 0 ? 0 : 1;
    let level = forceNear || (offset < 48 && z > -1320 && z < 800) ? 0 : offset < 265 && z > -2000 ? 1 : 2;
    while (!broadleaf && level < 2 && counts[sideIndex][level] >= limits[level]) level++;
    if (!broadleaf && counts[sideIndex][level] >= limits[level]) return;
    if (!allowed(x, z, height, height < 13 ? 2.9 : offset < 120 ? 4.6 : 7.0)) return;
    const openCanopy = Math.exp(-(((z - 590) / 110) ** 2)) * (offset < 35 ? .22 : .10);
    const item = { x, y: y - .12, z, height, width: (.83 + random(seed, 811) * .37) * (1 - openCanopy), yaw: random(seed, 814) * Math.PI * 2, lean: (random(seed, 816) - .5) * .032, variant, level, seed };
    if (broadleaf) aspens[sideIndex].push(item); else { trees[sideIndex].push(item); counts[sideIndex][level]++; }
  }

  // Mature trees frame the entrance; their clear trunks leave the wildlife,
  // stream and distant ridge visible between the canopies.
  const framing: Array<[number, number, number, number, number]> = [
    [-1, 592, 13.2, 36, 2], [1, 584, 22, 39, 0], [-1, 552, 24, 34, 0], [1, 535, 30, 38, 2],
    [-1, 495, 17, 31, 0], [1, 473, 29, 33, 0], [-1, 650, 19, 36, 2], [1, 649, 25, 41, 2],
    [-1, 565, 11.5, 9, 1], [1, 551, 10.9, 11, 1], [-1, 425, 12, 12, 1], [1, 405, 12, 13, 1],
  ];
  framing.forEach(([side, z, offset, height, variant], i) => place(side, z, offset, height, variant, 8900 + i, true));
  const leafyGroves: Array<[number, number, number]> = [[1, 565, 22], [-1, 527, 30], [1, 424, 38], [-1, 150, 46], [1, -425, 31], [-1, -953, 40]];
  leafyGroves.forEach(([side, centerZ, offset], grove) => {
    for (let i = 0; i < (mobile ? 10 : 17); i++) { const seed = 9100 + grove * 91 + i, z = centerZ + (random(seed, 902) + random(seed, 903) - 1) * 73, o = offset + (random(seed, 904) - .5) * 30; place(side, z, Math.max(12, o), 13 + random(seed, 907) * 10, 0, seed, false, true); }
  });
  for (const side of [-1, 1]) {
    const groves = [[570, 42, 55, 170], [350, 61, 71, 180], [65, 47, 66, 190], [-250, 67, 95, 210], [-590, 56, 84, 180], [-975, 52, 71, 190], [-1290, 74, 110, 190]];
    groves.forEach(([centerZ, offset, rx, rz], grove) => {
      for (let i = 0; i < (mobile ? 73 : 116); i++) {
        const seed = 10000 + (side + 1) * 2500 + grove * 151 + i;
        const z = centerZ + (random(seed, 10) + random(seed, 11) - 1) * rz;
        const o = Math.max(10, offset + (random(seed, 12) + random(seed, 13) - 1) * rx);
        const age = random(seed, 17), variant = age < .28 ? 1 : age > .86 ? 2 : 0;
        const height = variant === 1 ? 5.5 + random(seed, 19) * 11 : 23 + random(seed, 21) * 19;
        place(side, z, o, height, variant, seed);
      }
    });
    // The hillside forest grows in overlapping stands with open rock and meadow
    // between them, rather than one even scatter across every elevation.
    for (let grove = 0; grove < 27; grove++) {
      const seed = 17000 + (side + 1) * 2100 + grove * 117;
      const centerZ = 1000 - random(seed, 31) * 4350, offset = 110 + Math.pow(random(seed, 32), 1.3) * 930;
      const rx = 80 + random(seed, 33) * 165, rz = 115 + random(seed, 34) * 210;
      for (let i = 0; i < (mobile ? 85 : 139); i++) {
        const s = seed + i * 3, z = centerZ + (random(s, 41) + random(s, 42) + random(s, 43) - 1.5) * rz;
        const o = Math.max(30, offset + (random(s, 44) + random(s, 45) + random(s, 46) - 1.5) * rx);
        if (Math.sin(z * .009 + side) + Math.cos(o * .014) < -1.65) continue;
        const variant = random(s, 49) < .31 ? 1 : random(s, 50) > .87 ? 2 : 0;
        place(side, z, o, (variant === 1 ? 15 : 25) + random(s, 51) * 20, variant, s);
      }
    }
  }

  for (let side = 0; side < 2; side++) {
    const group = side ? right : left;
    for (let variant = 0; variant < 3; variant++) for (let level = 0; level < 3; level++) {
      const candidates = trees[side].filter(tree => tree.variant === variant && tree.level === level);
      // Bound each stand separately so offscreen trees are skipped in both the
      // main render and the much smaller nearby shadow camera.
      const stands = new Map<string, Tree[]>();
      for (const tree of candidates) {
        const cell = level === 0 ? 110 : level === 1 ? 190 : 380;
        const key = `${Math.floor(tree.x / cell)}:${Math.floor(tree.z / cell)}`;
        const stand = stands.get(key) || []; stand.push(tree); stands.set(key, stand);
      }
      for (const locations of stands.values()) {
        const model = conifers[variant][level], canopy = new T.InstancedMesh(model.foliage, needles, locations.length), trunks = new T.InstancedMesh(model.trunk, wood, locations.length);
        const branches = model.branches ? new T.InstancedMesh(model.branches, wood, locations.length) : undefined;
        locations.forEach((tree, i) => {
          dummy.position.set(tree.x, tree.y, tree.z); dummy.rotation.set(tree.lean, tree.yaw, tree.lean * .7); dummy.scale.set(tree.height * tree.width, tree.height, tree.height * tree.width); dummy.updateMatrix(); canopy.setMatrixAt(i, dummy.matrix); trunks.setMatrixAt(i, dummy.matrix); branches?.setMatrixAt(i, dummy.matrix);
          const tint = .80 + random(tree.seed, 102) * .18; color.setRGB(tint * (.98 + random(tree.seed, 100) * .04), tint, tint * (.92 + random(tree.seed, 101) * .09)); canopy.setColorAt(i, color);
          color.setRGB(.84 + random(tree.seed, 111) * .2, .85 + random(tree.seed, 112) * .18, .81 + random(tree.seed, 113) * .18); trunks.setColorAt(i, color); branches?.setColorAt(i, color);
        });
        canopy.castShadow = trunks.castShadow = level === 0; canopy.receiveShadow = trunks.receiveShadow = level < 2;
        canopy.computeBoundingSphere(); trunks.computeBoundingSphere(); branches?.computeBoundingSphere();
        // LOD geometry is close in size but not identical; reserve bounds once
        // so swapping detail never needs a per-instance bounds pass.
        const maximumHeight = Math.max(...locations.map(tree => tree.height));
        if (canopy.boundingSphere) canopy.boundingSphere.radius += maximumHeight * .16;
        if (trunks.boundingSphere) trunks.boundingSphere.radius += maximumHeight * .04;
        const center = locations.reduce((sum, tree) => { sum.x += tree.x; sum.z += tree.z; return sum; }, { x: 0, z: 0 });
        standsToAnimate.push({ canopy, trunks, branches, models: conifers[variant], baseLevel: level, level, x: center.x / locations.length, z: center.z / locations.length });
        group.add(canopy, trunks); if (branches) { branches.castShadow = !mobile; branches.receiveShadow = true; group.add(branches); }
      }
    }
    if (aspens[side].length) {
      const leafModels = [aspenLeaves];
      for (let level = 1; level <= 2; level++) {
        const reduced = keep(new T.BufferGeometry()), index: number[] = [];
        for (const name of ['position', 'uv', 'color']) reduced.setAttribute(name, aspenLeaves.getAttribute(name));
        const vertices = aspenLeaves.getAttribute('position').count;
        for (let leaf = 0; leaf < vertices / 6; leaf += level === 1 ? 2 : 4) {
          const base = leaf * 6; index.push(base, base + 1, base + 4, base + 1, base + 5, base + 4);
        }
        reduced.setIndex(index); reduced.computeVertexNormals(); reduced.computeBoundingSphere(); leafModels.push(reduced);
      }
      const aspenModels = leafModels.map(foliage => ({ foliage, trunk: aspenTrunk }));
      const groves = new Map<string, Tree[]>();
      for (const tree of aspens[side]) { const key = `${Math.floor(tree.x / 100)}:${Math.floor(tree.z / 120)}`, grove = groves.get(key) || []; grove.push(tree); groves.set(key, grove); }
      for (const locations of groves.values()) {
        const leaves = new T.InstancedMesh(aspenLeaves, leafy, locations.length), trunks = new T.InstancedMesh(aspenTrunk, paleWood, locations.length), branches = new T.InstancedMesh(aspenBranches, paleWood, locations.length);
        locations.forEach((tree, i) => {
        dummy.position.set(tree.x, tree.y, tree.z); dummy.rotation.set(tree.lean, tree.yaw, tree.lean); dummy.scale.set(tree.height * tree.width, tree.height, tree.height); dummy.updateMatrix(); leaves.setMatrixAt(i, dummy.matrix); trunks.setMatrixAt(i, dummy.matrix); branches.setMatrixAt(i, dummy.matrix);
        color.setHSL(.18 + random(tree.seed, 880) * .065, .13 + random(tree.seed, 881) * .15, .85 + random(tree.seed, 882) * .13); leaves.setColorAt(i, color);
        });
        leaves.computeBoundingSphere(); trunks.computeBoundingSphere(); branches.computeBoundingSphere();
        const center = locations.reduce((sum, tree) => { sum.x += tree.x; sum.z += tree.z; return sum; }, { x: 0, z: 0 });
        standsToAnimate.push({ canopy: leaves, trunks, branches, models: aspenModels, baseLevel: 0, level: 0, x: center.x / locations.length, z: center.z / locations.length });
        leaves.castShadow = trunks.castShadow = !mobile; leaves.receiveShadow = trunks.receiveShadow = true; group.add(leaves, trunks, branches);
      }
    }
  }
  let lastX = Infinity, lastZ = Infinity;
  return { animate: (seconds: number, cameraPosition?: Three.Vector3) => {
    wind.value = seconds;
    if (!cameraPosition || (cameraPosition.x - lastX) ** 2 + (cameraPosition.z - lastZ) ** 2 < 36) return;
    lastX = cameraPosition.x; lastZ = cameraPosition.z;
    const near = mobile ? 112 : 170, middle = mobile ? 280 : 390;
    for (const stand of standsToAnimate) {
      const distance = (cameraPosition.x - stand.x) ** 2 + (cameraPosition.z - stand.z) ** 2;
      const level = Math.max(stand.baseLevel, distance > middle * middle ? 2 : distance > near * near ? 1 : 0);
      stand.trunks.visible = distance < (mobile ? 430 : 650) ** 2;
      if (level === stand.level) continue;
      stand.level = level;
      stand.canopy.geometry = stand.models[level].foliage; stand.trunks.geometry = stand.models[level].trunk;
      stand.canopy.castShadow = stand.trunks.castShadow = level === 0;
      if (stand.branches) stand.branches.visible = level === 0;
    }
  } };
}
