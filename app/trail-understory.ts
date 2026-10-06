import type * as Three from 'three';
import { creekX } from './trail-terrain';

type UnderstoryOptions = {
  mobile: boolean;
  terrainHeight: (x: number, z: number) => number;
  trailX: (z: number) => number;
  resources: Set<Three.BufferGeometry | Three.Material | Three.Texture>;
};
type Surface = { positions: number[]; colors: number[]; indices: number[] };
type FlowerKind = 'violet' | 'blue' | 'cream' | 'gold';
type PlantKind = FlowerKind | 'shrub' | 'fern';
type PlantPose = { x: number; y: number; z: number; size: number; seed: number };
type Patch = { z: number; offset: number; kind: FlowerKind; spread: number; count: number; seed: number };

const random = (a: number, b: number) => {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** Small botanical meshes, planted in irregular colonies rather than a flower border. */
export function addTrailUnderstory(T: typeof import('three'), scene: Three.Scene, options: UnderstoryOptions) {
  const { mobile, terrainHeight, trailX, resources } = options;
  const keep = <V extends Three.BufferGeometry | Three.Material | Three.Texture>(value: V): V => { resources.add(value); return value; };
  const understory = new T.Group(); understory.name = 'Native understory and wildflower patches'; scene.add(understory);
  const time = { value: 0 };
  const plantChunks: Array<{ mesh: Three.InstancedMesh; x: number; z: number }> = [];
  const dummy = new T.Object3D(), color = new T.Color();
  const up = new T.Vector3(0, 1, 0);
  const surface = (): Surface => ({ positions: [], colors: [], indices: [] });

  function vertex(data: Surface, point: Three.Vector3, pigment: Three.Color) {
    data.positions.push(point.x, point.y, point.z);
    data.colors.push(pigment.r, pigment.g, pigment.b);
  }

  // A folded, pointed leaf has an actual raised midrib and two separate surfaces.
  // The same construction makes the cupped banner and wing petals of the lupines.
  function lamina(data: Surface, base: Three.Vector3, direction: Three.Vector3, normal: Three.Vector3, length: number, width: number, pigment: Three.Color, curl = .008) {
    const along = direction.clone().normalize();
    const across = along.clone().cross(normal).normalize();
    const face = across.clone().cross(along).normalize();
    const first = data.positions.length / 3;
    const points = [[0, 0, 0], [.42, -1, .12], [.53, 0, 1], [.42, 1, .12], [1, 0, -.35]];
    points.forEach(([t, side, ridge], i) => {
      const point = base.clone().addScaledVector(along, t * length).addScaledVector(across, side * width).addScaledVector(face, ridge * curl);
      vertex(data, point, pigment.clone().multiplyScalar(i === 2 ? 1.1 : i === 4 ? 1.03 : .95));
    });
    data.indices.push(first, first + 1, first + 2, first + 1, first + 4, first + 2, first + 4, first + 3, first + 2, first + 3, first, first + 2);
  }

  function stem(data: Surface, start: Three.Vector3, end: Three.Vector3, radius: number, pigment: Three.Color, taper = .65, sides = 4) {
    const direction = end.clone().sub(start).normalize();
    const across = direction.clone().cross(Math.abs(direction.y) > .92 ? new T.Vector3(1, 0, 0) : up).normalize();
    const normal = across.clone().cross(direction).normalize();
    const first = data.positions.length / 3;
    for (let ring = 0; ring < 2; ring++) for (let side = 0; side < sides; side++) {
      const angle = side / sides * Math.PI * 2, r = radius * (ring ? taper : 1);
      const point = (ring ? end : start).clone().addScaledVector(across, Math.cos(angle) * r).addScaledVector(normal, Math.sin(angle) * r);
      vertex(data, point, pigment.clone().multiplyScalar(.87 + side / sides * .16));
    }
    for (let side = 0; side < sides; side++) {
      const a = first + side, b = first + (side + 1) % sides;
      data.indices.push(a, b, a + sides, b, b + sides, a + sides);
    }
  }

  function geometry(data: Surface) {
    const result = keep(new T.BufferGeometry());
    result.setAttribute('position', new T.Float32BufferAttribute(data.positions, 3));
    result.setAttribute('color', new T.Float32BufferAttribute(data.colors, 3));
    result.setIndex(data.indices); result.computeVertexNormals(); result.computeBoundingSphere();
    return result;
  }

  function lupine(blue: boolean) {
    const data = surface();
    const height = blue ? .82 : .92;
    const green = new T.Color(0x54624a), paleGreen = new T.Color(0x7a8762);
    const flower = new T.Color(blue ? 0x647aa7 : 0x88719d), light = new T.Color(blue ? 0xa2aed0 : 0xb9a4cd);
    const center = (y: number) => new T.Vector3(Math.sin(y * 2.2) * .033, y, Math.sin(y * 3.7) * .021);
    for (let i = 0; i < 5; i++) stem(data, center(i / 5 * height), center((i + 1) / 5 * height), .0058 * (1 - i * .12), green);

    // Three palmate leaf fans below the raceme, with narrow separate leaflets.
    for (let fan = 0; fan < 3; fan++) {
      const angle = fan * 2.399 + (blue ? .6 : 0), y = .065 + fan * .115;
      const outward = new T.Vector3(Math.cos(angle), .28, Math.sin(angle));
      const palm = center(y).addScaledVector(outward, .12 + fan * .015);
      stem(data, center(y), palm, .0028, green);
      for (let leaf = 0; leaf < 7; leaf++) {
        const a = angle + (leaf - 3) * .63;
        const reach = new T.Vector3(Math.cos(a), .2 + Math.sin(leaf * 2.2) * .12, Math.sin(a));
        const length = .105 + Math.sin((leaf + 1) / 8 * Math.PI) * .062;
        lamina(data, palm, reach, up, length, .018 + (leaf % 2) * .003, green.clone().lerp(paleGreen, fan * .08 + leaf * .025), .008);
      }
    }

    const rows = mobile ? 7 : 9;
    for (let row = 0; row < rows; row++) {
      const t = row / rows, y = height * (.48 + t * .48);
      const radius = .018 * (1 - t * .63), petals = row < rows - 2 ? 4 : 3;
      for (let petal = 0; petal < petals; petal++) {
        const angle = petal / petals * Math.PI * 2 + row * 1.72;
        const outward = new T.Vector3(Math.cos(angle), .24, Math.sin(angle));
        const base = center(y).addScaledVector(outward, radius);
        const bloomColor = flower.clone().lerp(light, .15 + t * .51 + random(row, petal) * .1);
        const length = .045 * (1 - t * .45);
        lamina(data, base, new T.Vector3(outward.x * .35, 1, outward.z * .35), outward, length, .017 * (1 - t * .35), bloomColor, .009);
        lamina(data, base.clone().addScaledVector(outward, .009), new T.Vector3(outward.x, -.17, outward.z), up, length * .78, .016 * (1 - t * .4), bloomColor.clone().multiplyScalar(.86), .009);
      }
    }
    // Unopened, green-tipped buds keep the flower head from ending in a cut cylinder.
    for (let bud = 0; bud < 4; bud++) {
      const angle = bud * Math.PI / 2;
      lamina(data, center(height * .96), new T.Vector3(Math.cos(angle) * .2, 1, Math.sin(angle) * .2), new T.Vector3(Math.cos(angle), 0, Math.sin(angle)), .028, .007, light.clone().lerp(paleGreen, .5), .003);
    }
    return geometry(data);
  }

  function wildflower(gold: boolean) {
    const data = surface();
    const green = new T.Color(0x65724c), bloom = new T.Color(gold ? 0xc8ac69 : 0xe5decb), pollen = new T.Color(gold ? 0x947738 : 0xb29655);
    const branches = gold ? 3 : 2;
    for (let branch = 0; branch < branches; branch++) {
      const angle = branch * 2.399 + .3;
      const height = (gold ? .29 : .41) + random(branch, gold ? 37 : 41) * .16;
      const head = new T.Vector3(Math.cos(angle) * .08, height, Math.sin(angle) * .085);
      const middle = head.clone().multiplyScalar(.48); middle.y -= .013;
      stem(data, new T.Vector3(0, .005, 0), middle, .0038, green);
      stem(data, middle, head, .0025, green);
      for (let leaf = 0; leaf < 4; leaf++) {
        const t = .13 + leaf * .14, a = angle + leaf * 2.399;
        const at = head.clone().multiplyScalar(t);
        lamina(data, at, new T.Vector3(Math.cos(a), .3, Math.sin(a)), up, .08 + (leaf % 2) * .025, gold ? .016 : .011, green, .006);
      }
      const petals = gold ? 5 : 8;
      for (let petal = 0; petal < petals; petal++) {
        const a = petal / petals * Math.PI * 2 + branch * .7;
        lamina(data, head, new T.Vector3(Math.cos(a), gold ? .19 : -.045, Math.sin(a)), up, gold ? .038 : .051, gold ? .019 : .012, bloom.clone().multiplyScalar(.92 + random(petal, branch + 11) * .13), gold ? .009 : .004);
      }
      // The raised pollen disc uses a ring of small facets, not a floating sphere.
      const first = data.positions.length / 3;
      vertex(data, head.clone().add(new T.Vector3(0, .008, 0)), pollen.clone().multiplyScalar(1.08));
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2;
        vertex(data, head.clone().add(new T.Vector3(Math.cos(a) * .011, .003, Math.sin(a) * .011)), pollen);
      }
      for (let i = 0; i < 8; i++) data.indices.push(first, first + 1 + i, first + 1 + (i + 1) % 8);
    }
    return geometry(data);
  }

  function shrub() {
    const data = surface(), wood = new T.Color(0x66543b);
    const older = new T.Color(0x465c40), fresh = new T.Color(0x77825a);
    for (let branch = 0; branch < 5; branch++) {
      const angle = branch * 2.399, height = .32 + random(branch, 211) * .26;
      const end = new T.Vector3(Math.cos(angle) * .25, height, Math.sin(angle) * .25);
      const middle = end.clone().multiplyScalar(.44); middle.y += .055;
      stem(data, new T.Vector3(0, 0, 0), middle, .010, wood, .65, 5);
      stem(data, middle, end, .006, wood, .28, 4);
      for (let node = 0; node < 5; node++) for (const side of [-1, 1]) {
        const t = .23 + node * .155;
        const at = end.clone().multiplyScalar(t); at.y += Math.sin(t * Math.PI) * .06;
        const a = angle + side * (.7 + random(node, branch + 228) * .2);
        const direction = new T.Vector3(Math.cos(a), .21 + t * .32, Math.sin(a));
        const leafColor = older.clone().lerp(fresh, t * .58 + random(node + branch, side + 9) * .18);
        lamina(data, at, direction, up, .095 + random(node, branch + 238) * .05, .031 + node * .0015, leafColor, .011);
      }
    }
    return geometry(data);
  }

  function fern() {
    const data = surface(), midrib = new T.Color(0x5e6346), older = new T.Color(0x465c3f), fresh = new T.Color(0x738064), dry = new T.Color(0x857553);
    const fronds = mobile ? 5 : 7;
    for (let frond = 0; frond < fronds; frond++) {
      const angle = frond * 2.399, reach = .35 + random(frond, 471) * .21;
      const direction = new T.Vector3(Math.cos(angle), 0, Math.sin(angle));
      const cross = new T.Vector3(-direction.z, 0, direction.x);
      const point = (t: number) => direction.clone().multiplyScalar(t * reach).add(new T.Vector3(0, .027 + Math.sin(t * Math.PI * .80) * (.29 + random(frond, 472) * .16), 0));
      const rows = mobile ? 7 : 9;
      for (let row = 0; row < rows; row++) {
        const t = row / rows, next = (row + 1) / rows;
        stem(data, point(t), point(next), .0032 * (1 - t * .8), midrib, .8, 3);
        if (row === 0) continue;
        for (const side of [-1, 1]) {
          const seed = frond * 41 + row * 3 + side, at = point(t + (side > 0 ? .018 : 0));
          const leaflet = cross.clone().multiplyScalar(side).addScaledVector(direction, .37); leaflet.y = .07 + random(seed, 476) * .13;
          const length = Math.sin(t * Math.PI) * (.080 + random(seed, 477) * .027) + .009;
          const pigment = older.clone().lerp(fresh, t * .55 + random(seed, 478) * .18);
          if (frond === 2 && row < 4) pigment.lerp(dry, .62);
          lamina(data, at, leaflet, up, length, length * .20, pigment, .006);
        }
      }
      lamina(data, point(.96), direction.clone().add(new T.Vector3(0, -.15, 0)), up, .055, .009, fresh, .003);
    }
    return geometry(data);
  }

  const botanicalMaterial = keep(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .87, side: T.DoubleSide }));
  botanicalMaterial.onBeforeCompile = shader => {
    shader.uniforms.understoryTime = time;
    shader.vertexShader = 'uniform float understoryTime;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float plantSeed = instanceMatrix[3].x * .23 + instanceMatrix[3].z * .17;
      float flexibility = pow(max(position.y, 0.0), 1.7);
      transformed.x += (sin(understoryTime * .83 + plantSeed) + sin(understoryTime * .37 + plantSeed * .41) * .35) * flexibility * .027;
      transformed.z += cos(understoryTime * .61 + plantSeed * .7) * flexibility * .019;
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance += diffuseColor.rgb * .025;');
  };
  botanicalMaterial.customProgramCacheKey = () => 'summit-understory-botanical-v3';
  const dryMaterial = keep(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .98, side: T.DoubleSide }));
  const models: Record<PlantKind, Three.BufferGeometry> = { violet: lupine(false), blue: lupine(true), cream: wildflower(false), gold: wildflower(true), shrub: shrub(), fern: fern() };
  const poses: Record<PlantKind, PlantPose[]> = { violet: [], blue: [], cream: [], gold: [], shrub: [], fern: [] };

  const wildlifeClearings = [{ z: 600, offset: 7.5, xRadius: 2.6, zRadius: 3.8 }, { z: 610, offset: -4.9, xRadius: 1.8, zRadius: 2.8 }, { z: 180, offset: -8, xRadius: 3, zRadius: 4 }, { z: -930, offset: 9.2, xRadius: 3, zRadius: 4 }];
  function clearToPlant(z: number, offset: number, shrubPlant = false) {
    if (Math.abs(offset) < (shrubPlant ? 3.05 : 2.6)) return false;
    for (const animal of wildlifeClearings) {
      if (((offset - animal.offset) / animal.xRadius) ** 2 + ((z - animal.z) / animal.zRadius) ** 2 < 1) return false;
      // Preserve the opening camera's sightlines to the deer and rabbit as well.
      if (shrubPlant && animal.z >= 600 && z >= animal.z && z < 620) {
        const sightline = animal.offset * (620 - z) / (620 - animal.z);
        if (Math.abs(offset - sightline) < (shrubPlant ? 1.55 : 1.15)) return false;
      }
    }
    return true;
  }
  function place(kind: PlantKind, z: number, offset: number, seed: number, size: number) {
    if (!clearToPlant(z, offset, kind === 'shrub' || kind === 'fern')) return;
    const x = trailX(z) + offset, y = terrainHeight(x, z);
    if (!Number.isFinite(y)) return;
    if (z > 405 && z < 700 && Math.abs(x - creekX(z)) < 2.4) return;
    poses[kind].push({ x, y: y - .018, z, size, seed });
  }

  // Asymmetrical entrance colonies sit within a few metres of the walking trail.
  const opening: Array<[number, number, FlowerKind, number]> = [
    [616.8, 2.95, 'gold', .44], [615.2, -3.1, 'cream', .5],
    [609.4, 3.15, 'violet', .65], [606.2, 4.0, 'gold', .6],
    [603.7, -3.2, 'blue', .6], [597.8, 3.8, 'cream', .9],
    [588.5, 7.6, 'gold', 1.9], [578.8, 9.5, 'violet', 2.1],
    [614.0, 3.15, 'gold', .42], [617.0, 3.5, 'cream', .48],
    [612.0, 3.3, 'violet', .48], [617.2, -3.6, 'blue', .52],
    [615.5, 3.9, 'cream', .8], [612.5, 5.6, 'violet', 1.0],
    [606.4, -3.5, 'violet', .85], [600.8, -5.6, 'cream', 1.1],
    [596.4, 3.25, 'gold', .6], [591.2, 4.65, 'blue', 1.3],
    [589.0, -3.1, 'cream', .55], [581.4, -5.4, 'violet', 1.55],
    [577.2, 3.65, 'cream', .9], [565.5, -3.65, 'gold', 1.0],
    [558.2, 5.7, 'blue', 1.4], [550.3, -4.3, 'cream', .75],
  ];
  const patches: Patch[] = opening.map(([z, offset, kind, spread], i) => ({ z, offset, kind, spread, count: (mobile ? 8 : 13) + i % 4, seed: 1000 + i * 51 }));
  for (let i = 0; i < (mobile ? 42 : 74); i++) {
    const side = random(i, 314) < .5 ? -1 : 1;
    const kinds: FlowerKind[] = ['violet', 'cream', 'blue', 'violet', 'gold', 'cream'];
    patches.push({ z: 535 - random(i, 317) * 1870, offset: side * (3.0 + random(i, 319) ** 1.6 * 9), kind: kinds[Math.floor(random(i, 321) * kinds.length)], spread: .7 + random(i, 324) * 1.5, count: (mobile ? 5 : 7) + Math.floor(random(i, 328) * 7), seed: 2300 + i * 61 });
  }
  for (const patch of patches) {
    for (let i = 0; i < patch.count; i++) {
      const seed = patch.seed + i;
      const angle = random(seed, 343) * Math.PI * 2, radius = Math.sqrt(random(seed, 344)) * patch.spread;
      const z = patch.z + Math.sin(angle) * radius * 1.8, offset = patch.offset + Math.cos(angle) * radius;
      place(patch.kind, z, offset, seed, .56 + random(seed, 348) * .59);
    }
    // A few leafy stems at a colony's outer edge make flowers sit in vegetation.
    for (let i = 0; i < (mobile ? 2 : 3); i++) {
      const seed = patch.seed + 31 + i;
      const offset = patch.offset + Math.sign(patch.offset) * (.45 + random(seed, 355) * 1.1);
      place('shrub', patch.z + (random(seed, 358) - .5) * patch.spread * 3.2, offset, seed, .61 + random(seed, 361) * .49);
    }
  }

  // Low, arching fronds gather on the shaded banks in separated colonies.
  // Their open pinnate silhouettes leave the litter underneath visible.
  for (let colony = 0; colony < (mobile ? 15 : 24); colony++) {
    const seed = 5800 + colony * 47, side = colony % 3 ? -1 : 1;
    const z = colony < 8 ? 617 - random(seed, 481) * 150 : 445 - random(seed, 482) * 1650;
    const offset = side * (5.6 + random(seed, 484) * 19);
    for (let plant = 0; plant < 4 + colony % 4; plant++) {
      const s = seed + plant, a = random(s, 487) * Math.PI * 2, radius = Math.sqrt(random(s, 488)) * 2.4;
      place('fern', z + Math.sin(a) * radius * 1.4, offset + Math.cos(a) * radius, s, .70 + random(s, 489) * .58);
    }
  }

  function instances(name: string, model: Three.BufferGeometry, material: Three.Material, locations: PlantPose[], animated = true) {
    if (!locations.length) return;
    const chunks = new Map<string, PlantPose[]>();
    for (const location of locations) { const key = `${Math.floor(location.x / 80)}:${Math.floor(location.z / 70)}`, chunk = chunks.get(key) || []; chunk.push(location); chunks.set(key, chunk); }
    for (const chunk of chunks.values()) {
      const mesh = new T.InstancedMesh(model, material, chunk.length); mesh.name = name;
      chunk.forEach(({ x, y, z, size, seed }, i) => {
      dummy.position.set(x, y, z); dummy.rotation.set((random(seed, 381) - .5) * .12, random(seed, 382) * Math.PI * 2, (random(seed, 383) - .5) * .12); dummy.scale.set(size * (.88 + random(seed, 385) * .2), size, size); dummy.updateMatrix(); mesh.setMatrixAt(i, dummy.matrix);
      const tint = .83 + random(seed, 391) * .24;
      color.setRGB(tint, tint * (.98 + random(seed, 392) * .04), tint * (.95 + random(seed, 393) * .04)); mesh.setColorAt(i, color);
      });
      mesh.receiveShadow = true;
      // Tiny petals don't need an additional shadow-map pass over the whole valley.
      mesh.castShadow = !animated && !mobile;
      mesh.computeBoundingSphere(); understory.add(mesh);
      const center = chunk.reduce((sum, plant) => { sum.x += plant.x; sum.z += plant.z; return sum; }, { x: 0, z: 0 });
      plantChunks.push({ mesh, x: center.x / chunk.length, z: center.z / chunk.length });
    }
  }
  (Object.keys(models) as PlantKind[]).forEach(kind => instances(`Understory ${kind}`, models[kind], botanicalMaterial, poses[kind]));

  const twigData = surface(), twigColor = new T.Color(0x80735a);
  stem(twigData, new T.Vector3(-.25, .035, -.09), new T.Vector3(.3, .02, .11), .014, twigColor, .32, 5);
  stem(twigData, new T.Vector3(-.05, .03, -.018), new T.Vector3(.04, .052, -.22), .007, twigColor, .16, 4);
  stem(twigData, new T.Vector3(.17, .025, .06), new T.Vector3(.26, .058, -.055), .0045, twigColor, .15, 4);
  const coneData = surface(), coneColor = new T.Color(0x775b3b);
  for (let ring = 0; ring < 6; ring++) for (let scale = 0; scale < 5; scale++) {
    const a = scale / 5 * Math.PI * 2 + ring * 2.399, t = ring / 6;
    const r = Math.sin((t * .85 + .08) * Math.PI) * .038;
    const base = new T.Vector3(Math.cos(a) * r, .02 + t * .14, Math.sin(a) * r);
    lamina(coneData, base, new T.Vector3(Math.cos(a), .8, Math.sin(a)), new T.Vector3(Math.cos(a) * .3, 1, Math.sin(a) * .3), .036 * (1 - t * .35), .016, coneColor.clone().multiplyScalar(.84 + t * .35), .006);
  }
  const twigs: PlantPose[] = [], cones: PlantPose[] = [];
  for (let i = 0; i < (mobile ? 68 : 130); i++) {
    const near = i < 32, z = near ? 619 - random(i, 430) * 100 : 520 - random(i, 431) * 1710;
    const offset = (i % 2 ? 1 : -1) * (2.75 + random(i, 433) * 6.2);
    if (!clearToPlant(z, offset)) continue;
    const x = trailX(z) + offset;
    const pose = { x, y: terrainHeight(x, z) - .015, z, size: .68 + random(i, 438) * .7, seed: 7100 + i };
    (i % 3 === 0 ? cones : twigs).push(pose);
  }
  instances('Fallen branching twigs', geometry(twigData), dryMaterial, twigs, false);
  instances('Small pinecones', geometry(coneData), dryMaterial, cones, false);

  // Two small, earthy butterflies hover over existing flower colonies.
  const wingData = surface();
  const wingPoints = [[.004, 0, -.016], [.042, .004, -.067], [.084, .001, -.064], [.103, 0, -.025], [.071, .002, .008], [.078, .001, .046], [.039, 0, .06], [.01, 0, .035], [.038, .008, -.007]];
  wingPoints.forEach(([x, y, z], i) => vertex(wingData, new T.Vector3(x, y, z), new T.Color(i === 8 ? 0xc39152 : i === 0 || i === 7 ? 0x755839 : 0x473b2c)));
  for (let i = 0; i < 8; i++) wingData.indices.push(8, i, (i + 1) % 8);
  const wingGeometry = geometry(wingData);
  const butterflyMaterial = keep(new T.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: .85, side: T.DoubleSide }));
  const insectBody = surface(); stem(insectBody, new T.Vector3(0, 0, -.032), new T.Vector3(0, 0, .035), .005, new T.Color(0x44382b), .55, 5);
  const insectGeometry = geometry(insectBody);
  const butterflies = Array.from({ length: mobile ? 1 : 2 }, (_, i) => {
    const root = new T.Group(), left = new T.Group(), right = new T.Group();
    const leftWing = new T.Mesh(wingGeometry, butterflyMaterial), rightWing = new T.Mesh(wingGeometry, butterflyMaterial);
    leftWing.scale.x = -1; left.add(leftWing); right.add(rightWing); root.add(left, right, new T.Mesh(insectGeometry, butterflyMaterial));
    understory.add(root);
    return { root, left, right, z: i ? 585.2 : 605.4, offset: i ? 4.1 : -3.65, phase: i * 2.1 };
  });

  let lastX = Infinity, lastZ = Infinity;
  const animate = (seconds: number, cameraPosition?: Three.Vector3) => {
    time.value = seconds;
    if (cameraPosition && (cameraPosition.x - lastX) ** 2 + (cameraPosition.z - lastZ) ** 2 >= 36) {
      lastX = cameraPosition.x; lastZ = cameraPosition.z;
      const range = mobile ? 105 : 155;
      for (const chunk of plantChunks) chunk.mesh.visible = (cameraPosition.x - chunk.x) ** 2 + (cameraPosition.z - chunk.z) ** 2 < range * range;
    }
    for (const butterfly of butterflies) {
      const phase = seconds * .59 + butterfly.phase;
      const z = butterfly.z + Math.cos(phase * .67) * .52, x = trailX(z) + butterfly.offset + Math.sin(phase) * .45;
      butterfly.root.position.set(x, terrainHeight(x, z) + .84 + Math.sin(phase * 1.7) * .17, z);
      butterfly.root.rotation.y = Math.atan2(Math.cos(phase) * .45, -Math.sin(phase * .67) * .35);
      butterfly.root.rotation.z = Math.sin(phase * .91) * .12;
      const flap = .57 + Math.sin(seconds * 12.4 + butterfly.phase) * .62;
      butterfly.left.rotation.z = -flap; butterfly.right.rotation.z = flap;
    }
  };
  animate(0);
  return { animate };
}
