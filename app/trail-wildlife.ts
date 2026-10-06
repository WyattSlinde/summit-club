import type * as Three from 'three';

type WildlifeOptions = {
  mobile: boolean;
  terrainHeight: (x: number, z: number) => number;
  trailX: (z: number) => number;
  resources: Set<Three.BufferGeometry | Three.Material | Three.Texture>;
};
type Part = { at: [number, number, number]; size: [number, number, number]; color: number; rotation?: [number, number, number] };
type Section = { x: number; y: number; a: number; b: number };
type LegRig = { bones: Three.Bone[]; hind: boolean; side: number };
const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
const catmull = (a: number, b: number, c: number, d: number, t: number) => .5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);

/** Original procedural anatomy, with nearby wildlife responding quietly to the camera. */
export function addTrailWildlife(T: typeof import('three'), scene: Three.Scene, options: WildlifeOptions) {
  const { mobile, terrainHeight, trailX, resources } = options;
  const register = <V extends Three.BufferGeometry | Three.Material | Three.Texture>(value: V): V => { resources.add(value); return value; };
  const wildlife = new T.Group(); wildlife.name = 'Trail wildlife'; scene.add(wildlife);
  const sphere = register(new T.SphereGeometry(1, mobile ? 16 : 20, mobile ? 12 : 14));
  const dummy = new T.Object3D(), color = new T.Color(), blend = new T.Color();

  const furCanvas = document.createElement('canvas'); furCanvas.width = 512; furCanvas.height = 256;
  const furContext = furCanvas.getContext('2d');
  if (furContext) {
    furContext.fillStyle = '#ebe7de'; furContext.fillRect(0, 0, 512, 256); furContext.lineCap = 'round';
    for (let i = 0; i < 16500; i++) {
      const hash = Math.sin(i * 127.1 + 19) * 43758.5453, n = hash - Math.floor(hash);
      const x = (i * 83.731) % 512, y = (i * 37.417) % 256;
      furContext.strokeStyle = i % 3 ? '#938a793d' : '#ffffff63'; furContext.lineWidth = .35 + n * .45;
      furContext.beginPath(); furContext.moveTo(x, y); furContext.quadraticCurveTo(x + 1.2, y + 2.5, x + 1.5 + n, y + 4 + n * 6); furContext.stroke();
    }
  }
  const furTexture = register(new T.CanvasTexture(furCanvas)); furTexture.colorSpace = T.SRGBColorSpace; furTexture.wrapS = furTexture.wrapT = T.RepeatWrapping; furTexture.repeat.set(2, 2); furTexture.anisotropy = 4;
  const fur = register(new T.MeshStandardMaterial({ color: 0xffffff, map: furTexture, bumpMap: furTexture, bumpScale: .0022, roughness: .96 }));
  const anatomyFur = register(fur.clone()); anatomyFur.vertexColors = true;
  const eyeMaterial = register(new T.MeshStandardMaterial({ color: 0xffffff, roughness: .2 }));

  function parts(parent: Three.Object3D, geometry: Three.BufferGeometry, items: Part[], material: Three.Material = fur) {
    const mesh = new T.InstancedMesh(geometry, material, items.length);
    items.forEach((item, i) => {
      dummy.position.set(...item.at); dummy.scale.set(...item.size); dummy.rotation.set(...(item.rotation || [0, 0, 0])); dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix); mesh.setColorAt(i, color.set(item.color));
    });
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }

  function sample(sections: Section[], t: number): Section {
    const f = clamp(t) * (sections.length - 1), i = Math.min(Math.floor(f), sections.length - 2), u = f - i;
    const p0 = sections[Math.max(0, i - 1)], p1 = sections[i], p2 = sections[i + 1], p3 = sections[Math.min(sections.length - 1, i + 2)];
    return { x: catmull(p0.x, p1.x, p2.x, p3.x, u), y: catmull(p0.y, p1.y, p2.y, p3.y, u), a: Math.max(.001, catmull(p0.a, p1.a, p2.a, p3.a, u)), b: Math.max(.001, catmull(p0.b, p1.b, p2.b, p3.b, u)) };
  }

  type Coloring = (t: number, around: number, x: number, y: number, z: number) => Three.Color;
  // One continuous surface follows the anatomical cross-sections, rather than
  // overlapping primitives that leave visible seams at the ribs and cheeks.
  function surface(sections: Section[], coloring: Coloring, tube = false, rings = mobile ? 34 : 46, sides = mobile ? 20 : 28) {
    const positions: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
    for (let ring = 0; ring <= rings; ring++) {
      const t = ring / rings, s = sample(sections, t), before = sample(sections, Math.max(0, t - .003)), after = sample(sections, Math.min(1, t + .003));
      const angle = Math.atan2(after.y - before.y, after.x - before.x), nx = tube ? -Math.sin(angle) : 0, ny = tube ? Math.cos(angle) : 1;
      for (let side = 0; side <= sides; side++) {
        const a = side / sides * Math.PI * 2, c = Math.cos(a), z = Math.sin(a) * s.b;
        const x = s.x + nx * c * s.a, y = s.y + ny * c * s.a;
        positions.push(x, y, z); uv.push(t, side / sides);
        const pigment = coloring(t, c, x, y, z); colors.push(pigment.r, pigment.g, pigment.b);
        if (ring < rings && side < sides) { const i = ring * (sides + 1) + side; indices.push(i, i + 1, i + sides + 1, i + 1, i + sides + 2, i + sides + 1); }
      }
    }
    if (!tube) for (const end of [0, 1]) {
      const s = sample(sections, end), center = positions.length / 3, first = end * rings * (sides + 1);
      positions.push(s.x, s.y, 0); uv.push(end, .5); const pigment = coloring(end, 0, s.x, s.y, 0); colors.push(pigment.r, pigment.g, pigment.b);
      for (let side = 0; side < sides; side++) { if (end) indices.push(center, first + side, first + side + 1); else indices.push(center, first + side + 1, first + side); }
    }
    const geometry = register(new T.BufferGeometry()); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
    const normals = geometry.getAttribute('normal');
    for (let ring = 0; ring <= rings; ring++) { const first = ring * (sides + 1), last = first + sides, v = new T.Vector3(normals.getX(first) + normals.getX(last), normals.getY(first) + normals.getY(last), normals.getZ(first) + normals.getZ(last)).normalize(); normals.setXYZ(first, v.x, v.y, v.z); normals.setXYZ(last, v.x, v.y, v.z); }
    geometry.computeBoundingSphere(); return geometry;
  }

  const tawny = new T.Color(0xa48a69), flank = new T.Color(0xb39a74), dorsal = new T.Color(0x766751), cream = new T.Color(0xddd1b7), agouti = new T.Color(0x9e9580), rabbitBack = new T.Color(0x756f60);
  const deerCoat: Coloring = (_t, around, x, y, z) => {
    const mottle = (Math.sin(x * 29 + y * 13) * Math.sin(z * 38 + x * 9) + 1) * .5;
    color.copy(tawny).lerp(flank, .2 + mottle * .24).lerp(dorsal, smooth(.60, .97, around) * .55);
    color.lerp(cream, (1 - smooth(-.8, -.30, around)) * .82);
    return color;
  };
  const rabbitCoat: Coloring = (_t, around, x, y, z) => { color.copy(agouti).lerp(rabbitBack, smooth(.25, .90, around) * .51).lerp(cream, (1 - smooth(-.75, -.32, around)) * .86); color.multiplyScalar(.94 + (Math.sin(x * 57 + z * 31 + y * 8) + 1) * .04); return color; };
  const deerBodyGeometry = surface([
    { x: -.79, y: 1.10, a: .017, b: .019 }, { x: -.67, y: 1.08, a: .195, b: .185 },
    { x: -.46, y: 1.085, a: .285, b: .242 }, { x: -.23, y: 1.06, a: .277, b: .231 },
    { x: .025, y: 1.05, a: .25, b: .203 }, { x: .25, y: 1.085, a: .28, b: .208 },
    { x: .445, y: 1.145, a: .293, b: .224 }, { x: .575, y: 1.155, a: .21, b: .178 },
    { x: .65, y: 1.17, a: .075, b: .070 }, { x: .666, y: 1.17, a: .005, b: .006 },
  ], deerCoat);
  const deerHeadGeometry = surface([
    { x: -.155, y: .035, a: .010, b: .009 }, { x: -.095, y: .035, a: .095, b: .072 },
    { x: -.025, y: .032, a: .127, b: .099 }, { x: .065, y: .02, a: .116, b: .094 },
    { x: .16, y: -.012, a: .076, b: .073 }, { x: .28, y: -.039, a: .048, b: .058 },
    { x: .389, y: -.046, a: .043, b: .055 }, { x: .433, y: -.046, a: .019, b: .032 },
  ], (t, around, x, y, z) => { deerCoat(t, around, x, y, z); color.lerp(blend.set(0x3d3b31), smooth(.85, .98, t)); return color; }, false, 34, mobile ? 20 : 28);
  const neckGeometry = surface([
    { x: 0, y: -.015, a: .20, b: .178 }, { x: .055, y: .13, a: .173, b: .139 },
    { x: .137, y: .315, a: .13, b: .104 }, { x: .225, y: .505, a: .097, b: .084 },
    { x: .29, y: .64, a: .072, b: .072 },
  ], (t, around, x, y, z) => { deerCoat(t, around, x, y, z); color.lerp(cream, (1 - smooth(-.8, -.25, around)) * .45); return color; }, true, 30);
  const jawGeometry = surface([{ x: .07, y: -.064, a: .018, b: .033 }, { x: .16, y: -.077, a: .022, b: .052 }, { x: .29, y: -.080, a: .015, b: .054 }, { x: .40, y: -.07, a: .006, b: .037 }], () => color.copy(cream).multiplyScalar(.9), false, 22, 16);

  function anatomy(parent: Three.Object3D, geometry: Three.BufferGeometry) { const mesh = new T.Mesh(geometry, anatomyFur); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh; }

  // Thin, cupped ears: the interior sits below the rim instead of being a pink
  // ellipsoid laid over another ellipsoid.
  function earGeometry(rabbit = false) {
    const positions: number[] = [], colors: number[] = [], uv: number[] = [], indices: number[] = [];
    const rows = 15, columns = 10;
    for (let face = 0; face < 2; face++) for (let row = 0; row <= rows; row++) {
      const t = row / rows, width = Math.pow(Math.sin(Math.PI * t), rabbit ? .6 : .83) * (rabbit ? .37 : .52) * (.64 + .36 * t);
      for (let column = 0; column <= columns; column++) {
        const u = column / columns * 2 - 1, bowl = (1 - u * u) * Math.sin(Math.PI * t);
        positions.push(width * u, t, -.19 * bowl - face * .045); uv.push(column / columns, t);
        const inner = face === 0 ? (1 - smooth(.53, .92, Math.abs(u))) * smooth(.1, .3, t) * (1 - smooth(.87, 1, t)) : 0;
        color.copy(rabbit ? agouti : tawny).lerp(blend.set(rabbit ? 0xb09582 : 0xa78e74), inner * .8).lerp(cream, smooth(.8, .98, Math.abs(u)) * .18); colors.push(color.r, color.g, color.b);
        if (row < rows && column < columns) { const a = face * (rows + 1) * (columns + 1) + row * (columns + 1) + column, b = a + columns + 1; if (face === 0) indices.push(a, a + 1, b, a + 1, b + 1, b); else indices.push(a, b, a + 1, a + 1, b, b + 1); }
      }
    }
    const geometry = register(new T.BufferGeometry()); geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
  }
  const doeEarGeometry = earGeometry(), bunnyEarGeometry = earGeometry(true);

  const frontSections: Section[] = [{ x: 0, y: 0, a: .067, b: .057 }, { x: .052, y: -.52, a: .031, b: .027 }, { x: .015, y: -.91, a: .020, b: .021 }, { x: .044, y: -1.04, a: .024, b: .026 }];
  const hindSections: Section[] = [{ x: 0, y: 0, a: .115, b: .080 }, { x: .18, y: -.35, a: .050, b: .043 }, { x: -.087, y: -.73, a: .027, b: .027 }, { x: -.02, y: -1.04, a: .023, b: .024 }];
  function legGeometry(sections: Section[]) {
    const rings = 30, sides = 12;
    const geometry = surface(sections, (t, around, x, y, z) => { deerCoat(t, around * .4, x, y, z); color.lerp(blend.set(0x7b6a51), smooth(.52, .95, t) * .62); return color; }, true, rings, sides);
    const skinIndices: number[] = [], weights: number[] = [];
    for (let row = 0; row <= rings; row++) {
      const f = row / rings * 3, segment = Math.min(2, Math.floor(f)), weight = smooth(.60, 1, f - segment);
      for (let side = 0; side <= sides; side++) { skinIndices.push(segment, segment + 1, 0, 0); weights.push(1 - weight, weight, 0, 0); }
    }
    geometry.setAttribute('skinIndex', new T.Uint16BufferAttribute(skinIndices, 4)); geometry.setAttribute('skinWeight', new T.Float32BufferAttribute(weights, 4)); return geometry;
  }
  const frontLegGeometry = legGeometry(frontSections), hindLegGeometry = legGeometry(hindSections);
  function addLeg(parent: Three.Group, hind: boolean, side: number): LegRig {
    const sections = hind ? hindSections : frontSections, bones: Three.Bone[] = [];
    for (let i = 0; i < sections.length; i++) { const bone = new T.Bone(); if (i) { bone.position.set(sections[i].x - sections[i - 1].x, sections[i].y - sections[i - 1].y, 0); bones[i - 1].add(bone); } bones.push(bone); }
    const mesh = new T.SkinnedMesh(hind ? hindLegGeometry : frontLegGeometry, anatomyFur); mesh.position.set(hind ? -.45 : .43, 1.09, side * .153); mesh.rotation.x = side * .013; mesh.add(bones[0]);
    const skeleton = new T.Skeleton(bones); mesh.bind(skeleton); skeleton.computeBoneTexture(); if (skeleton.boneTexture) register(skeleton.boneTexture);
    mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; parent.add(mesh);
    parts(bones[3], sphere, [-1, 1].map(toe => ({ at: [.029, -.020, toe * .016] as [number, number, number], size: [.066, .029, .015] as [number, number, number], color: 0x48483b })));
    return { bones, hind, side };
  }

  const shadowCanvas = document.createElement('canvas'); shadowCanvas.width = shadowCanvas.height = 64;
  const shadowContext = shadowCanvas.getContext('2d');
  if (shadowContext) { const gradient = shadowContext.createRadialGradient(32, 32, 3, 32, 32, 31); gradient.addColorStop(0, '#ffffffaa'); gradient.addColorStop(.4, '#ffffff77'); gradient.addColorStop(1, '#ffffff00'); shadowContext.fillStyle = gradient; shadowContext.fillRect(0, 0, 64, 64); }
  const shadowTexture = register(new T.CanvasTexture(shadowCanvas));
  const shadowMaterial = register(new T.MeshBasicMaterial({ color: 0x152015, map: shadowTexture, transparent: true, opacity: .21, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  const shadowGeometry = register(new T.PlaneGeometry(1, 1));
  function contactShadow(parent: Three.Group, length: number, width: number) { const mesh = new T.Mesh(shadowGeometry, shadowMaterial); mesh.rotation.x = -Math.PI / 2; mesh.position.y = .017; mesh.scale.set(length, width, 1); parent.add(mesh); }

  const deer: Array<{ root: Three.Group; torso: Three.Mesh; neck: Three.Group; head: Three.Group; jaw: Three.Group; ears: Three.Group[]; tail: Three.Group; legs: LegRig[]; phase: number; grazing: boolean; alert: number; yaw: number }> = [];
  function makeDeer(z: number, offset: number, size: number, phase: number, grazing: boolean) {
    const root = new T.Group(); root.name = grazing ? 'Grazing doe' : 'Woodland doe';
    const x = trailX(z) + offset, yaw = offset > 0 ? Math.PI + .16 : -.12; root.position.set(x, terrainHeight(x, z), z); root.rotation.y = yaw; root.scale.setScalar(size); wildlife.add(root); contactShadow(root, 2.1, 1.0);
    const torso = anatomy(root, deerBodyGeometry), legs: LegRig[] = [];
    for (const side of [-1, 1]) { legs.push(addLeg(root, false, side), addLeg(root, true, side)); }
    const neck = new T.Group(); neck.position.set(.49, 1.13, 0); neck.rotation.order = 'YXZ'; root.add(neck); anatomy(neck, neckGeometry);
    const head = new T.Group(); head.position.set(.295, .648, 0); head.scale.setScalar(.91); neck.add(head); anatomy(head, deerHeadGeometry);
    const eyes: Part[] = [];
    for (const side of [-1, 1]) {
      eyes.push({ at: [.067, .073, side * .083], size: [.020, .015, .010], color: 0x574734 });
      eyes.push({ at: [.070, .075, side * .091], size: [.014, .011, .007], color: 0x151b15 });
      eyes.push({ at: [.075, .080, side * .096], size: [.0027, .0028, .0017], color: 0xc8c9b8 });
      eyes.push({ at: [.399, -.039, side * .049], size: [.017, .007, .006], color: 0x252c23 });
    }
    parts(head, sphere, eyes, eyeMaterial);
    const jaw = new T.Group(); head.add(jaw); anatomy(jaw, jawGeometry);
    const ears: Three.Group[] = [];
    for (const side of [-1, 1]) { const ear = new T.Group(); ear.position.set(-.065, .115, side * .068); ear.rotation.set(side * .52, side < 0 ? Math.PI : 0, -.27); ear.scale.set(.15, .31, .15); anatomy(ear, doeEarGeometry); head.add(ear); ears.push(ear); }
    const tail = new T.Group(); tail.position.set(-.755, 1.135, 0); root.add(tail);
    parts(tail, sphere, [{ at: [-.06, -.067, 0], size: [.069, .111, .042], rotation: [0, 0, -.40], color: 0x806f52 }, { at: [-.058, -.074, .018], size: [.042, .082, .032], rotation: [0, 0, -.40], color: 0xe3d8bf }]);
    deer.push({ root, torso, neck, head, jaw, ears, tail, legs, phase, grazing, alert: 0, yaw });
  }
  makeDeer(600, 7.5, 1.08, 0, true); makeDeer(180, -8, 1.03, 5.7, false); makeDeer(-930, 9.2, 1.05, 9.1, true);

  const rabbitBodyGeometry = surface([
    { x: -.365, y: .245, a: .012, b: .013 }, { x: -.28, y: .25, a: .163, b: .118 },
    { x: -.165, y: .252, a: .202, b: .153 }, { x: -.045, y: .243, a: .18, b: .143 },
    { x: .085, y: .24, a: .145, b: .114 }, { x: .185, y: .255, a: .114, b: .090 },
    { x: .245, y: .278, a: .032, b: .029 },
  ], rabbitCoat, false, 32);
  const rabbitHeadGeometry = surface([
    { x: -.112, y: .019, a: .01, b: .011 }, { x: -.062, y: .018, a: .093, b: .078 },
    { x: .008, y: .014, a: .11, b: .094 }, { x: .078, y: -.002, a: .079, b: .082 },
    { x: .133, y: -.023, a: .040, b: .051 }, { x: .181, y: -.027, a: .018, b: .025 },
  ], rabbitCoat, false, 28, 22);
  const whiskerMaterial = register(new T.LineBasicMaterial({ color: 0xb7ac95, transparent: true, opacity: .44 }));
  const whiskerGeometry = register(new T.BufferGeometry()), whiskers: number[] = [];
  for (const side of [-1, 1]) for (let strand = 0; strand < 3; strand++) whiskers.push(.135, -.035, side * .045, .18 + strand * .018, -.035 + (strand - 1) * .022, side * (.122 + strand * .011));
  whiskerGeometry.setAttribute('position', new T.Float32BufferAttribute(whiskers, 3));
  const rabbits: Array<{ anchor: Three.Group; body: Three.Group; torso: Three.Mesh; head: Three.Group; nose: Three.Group; ears: Three.Group[]; front: Three.Group[]; rear: Three.Group[]; z: number; offset: number; phase: number; yaw: number; alert: number }> = [];
  function makeRabbit(z: number, offset: number, phase: number) {
    const anchor = new T.Group(), body = new T.Group(); anchor.name = 'Trail rabbit'; anchor.add(body); wildlife.add(anchor); anchor.scale.setScalar(.78);
    const yaw = offset > 0 ? Math.PI - .15 : .07, x = trailX(z) + offset; anchor.rotation.y = yaw; anchor.position.set(x, terrainHeight(x, z), z); contactShadow(anchor, .84, .52);
    const torso = anatomy(body, rabbitBodyGeometry);
    parts(body, sphere, [{ at: [-.35, .266, 0], size: [.066, .066, .060], color: 0xded8c7 }]);
    const front: Three.Group[] = [], rear: Three.Group[] = [];
    for (const side of [-1, 1]) {
      const fore = new T.Group(); fore.position.set(.12, .217, side * .083); body.add(fore);
      parts(fore, sphere, [{ at: [.025, -.09, 0], size: [.030, .12, .030], rotation: [0, 0, .13], color: 0xa1957e }, { at: [.075, -.183, .003], size: [.092, .032, .035], color: 0xaa9d85 }]); front.push(fore);
      const hind = new T.Group(); hind.position.set(-.175, .201, side * .113); body.add(hind);
      parts(hind, sphere, [{ at: [.015, -.063, 0], size: [.084, .112, .065], rotation: [0, 0, -.28], color: 0x968b73 }, { at: [.07, -.163, .008], size: [.136, .041, .049], color: 0x9d927b }]); rear.push(hind);
    }
    const head = new T.Group(); head.position.set(.242, .373, 0); head.scale.setScalar(.89); body.add(head); anatomy(head, rabbitHeadGeometry);
    const eyes: Part[] = [];
    for (const side of [-1, 1]) { eyes.push({ at: [.027, .055, side * .078], size: [.018, .020, .012], color: 0xb2a58b }); eyes.push({ at: [.032, .055, side * .088], size: [.013, .015, .007], color: 0x171d15 }); eyes.push({ at: [.036, .060, side * .093], size: [.0028, .003, .0018], color: 0xc8ccbd }); }
    parts(head, sphere, eyes, eyeMaterial); head.add(new T.LineSegments(whiskerGeometry, whiskerMaterial));
    const nose = new T.Group(); head.add(nose); parts(nose, sphere, [{ at: [.18, -.027, 0], size: [.014, .010, .017], color: 0x655346 }]);
    const ears: Three.Group[] = [];
    for (const side of [-1, 1]) { const ear = new T.Group(); ear.position.set(-.038, .087, side * .044); ear.scale.set(.108, .254, .105); ear.rotation.set(side * .17, side < 0 ? Math.PI : 0, .10 + side * .035); anatomy(ear, bunnyEarGeometry); head.add(ear); ears.push(ear); }
    rabbits.push({ anchor, body, torso, head, nose, ears, front, rear, z, offset, phase, yaw, alert: 0 });
  }
  makeRabbit(610, -4.9, 0); makeRabbit(-405, 6.8, 4.6);

  let previousTime = 0;
  const cameraLocal = new T.Vector3(), worldUp = new T.Vector3(0, 1, 0), focusPosition = new T.Vector3();
  const animate = (seconds: number, cameraPosition?: Three.Vector3) => {
    const dt = Math.min(Math.max(seconds - previousTime, 0), .08) || .016; previousTime = seconds;
    const response = 1 - Math.exp(-dt * 2.8);
    for (const doe of deer) {
      const time = seconds + doe.phase, cycle = time % 28;
      let attention = 0, glance = 0;
      if (cameraPosition) {
        const distance = doe.root.position.distanceTo(cameraPosition); attention = (1 - smooth(11, 25, distance)) * (1 - smooth(4, 10, Math.abs(cameraPosition.y - doe.root.position.y)));
        cameraLocal.copy(cameraPosition).sub(doe.root.position).applyAxisAngle(worldUp, -doe.yaw); glance = Math.max(-.65, Math.min(.65, Math.atan2(-cameraLocal.z, cameraLocal.x)));
      }
      doe.alert += (attention - doe.alert) * response;
      const naturalLook = smooth(11, 13, cycle) * (1 - smooth(17, 19.5, cycle)), looking = Math.max(naturalLook, doe.alert);
      const grazingAngle = -1.64 + Math.sin(time * .61) * .033, standingAngle = -.19 + Math.sin(time * .31) * .022;
      doe.neck.rotation.z = doe.grazing ? grazingAngle + (standingAngle - grazingAngle) * looking : standingAngle;
      doe.neck.rotation.y = glance * doe.alert * .75 + Math.sin(time * .22) * .022;
      doe.head.rotation.set(0, glance * doe.alert * .28 + Math.sin(time * .33) * .025, -.015 + Math.sin(time * .74) * .013);
      doe.jaw.rotation.z = Math.sin(time * 2.65) * .007 * (1 - doe.alert); doe.torso.scale.y = 1 + Math.sin(time * 1.35) * .0025;
      doe.ears.forEach((ear, index) => { const side = index ? 1 : -1, twitch = Math.max(0, Math.sin(time * .39 + index * 2.2)) ** 16; ear.rotation.x = side * (.52 - doe.alert * .18) + Math.sin(time * 5.1 + index) * .09 * twitch; ear.rotation.z = -.27 + Math.sin(time * .2 + index) * .035; });
      doe.tail.rotation.x = Math.sin(time * .7) * .025 + Math.sin(time * 5.9) * Math.max(0, Math.sin(time * .23)) ** 22 * .19;
      doe.legs.forEach((leg, i) => { const shift = Math.sin(time * .28 + i * 1.2) * .009, lift = leg.hind ? 0 : Math.max(0, Math.sin(time * .24 + i * 2.6)) ** 30 * .07; leg.bones[0].rotation.z = shift + lift; leg.bones[1].rotation.z = -shift * .65 - lift * 1.8; leg.bones[2].rotation.z = lift * .4; });
    }
    for (const rabbit of rabbits) {
      const time = seconds + rabbit.phase, cycle = time % 26;
      const outward = smooth(7.2, 7.78, cycle) * .5 + smooth(8.0, 8.58, cycle) * .5;
      const returning = smooth(19.2, 19.78, cycle) * .5 + smooth(20.0, 20.58, cycle) * .5, travel = outward - returning;
      let hop = 0, stride = 0;
      for (const start of [7.2, 8.0, 19.2, 20.0]) { const t = (cycle - start) / .58; if (t > 0 && t < 1) { hop = Math.sin(t * Math.PI); stride = t; } }
      const crouch = (smooth(6.8, 7.15, cycle) * (1 - smooth(7.15, 7.27, cycle))) + (smooth(18.8, 19.15, cycle) * (1 - smooth(19.15, 19.27, cycle)));
      const x = trailX(rabbit.z) + rabbit.offset + Math.sign(rabbit.offset) * travel * .67, z = rabbit.z - travel * .17;
      rabbit.anchor.position.set(x, terrainHeight(x, z), z);
      const facingOut = smooth(5.7, 7.0, cycle) * (1 - smooth(17.7, 19.0, cycle)); rabbit.anchor.rotation.y = rabbit.yaw + Math.PI * facingOut;
      rabbit.body.position.y = hop * .11 - crouch * .022; rabbit.body.rotation.z = Math.sin(stride * Math.PI * 2) * hop * .07;
      rabbit.front.forEach(leg => { leg.rotation.z = hop * (.36 - stride * .60); }); rabbit.rear.forEach(leg => { leg.rotation.z = crouch * .16 + hop * (-.38 + stride * .65); });
      const distance = cameraPosition ? rabbit.anchor.position.distanceTo(cameraPosition) : 100;
      const attention = 1 - smooth(7, 16, distance); rabbit.alert += (attention - rabbit.alert) * response;
      rabbit.head.rotation.set(0, Math.sin(time * .34) * .06 * (1 - rabbit.alert), -.10 + rabbit.alert * .16 + Math.sin(time * .7) * .017); rabbit.nose.position.y = Math.sin(time * 8.7) * .0013; rabbit.torso.scale.y = 1 + Math.sin(time * 2.1) * .003;
      rabbit.ears.forEach((ear, index) => { const side = index ? 1 : -1, twitch = Math.max(0, Math.sin(time * .51 + index * 2.1)) ** 18; ear.rotation.x = side * (.17 - rabbit.alert * .12) + Math.sin(time * 6.7 + index) * .12 * twitch; ear.rotation.z = .10 + side * .035 - hop * .13 - rabbit.alert * .12 + Math.sin(time * .28 + index) * .025; });
    }
  };
  const focusPoint = (cameraPosition: Three.Vector3): Three.Vector3 | null => {
    let nearest: Three.Group | undefined, best = Infinity, targetHeight = 0;
    for (const doe of deer) {
      const distance = doe.root.position.distanceToSquared(cameraPosition), score = distance * .79;
      if (distance <= 85 * 85 && score < best) { nearest = doe.root; best = score; targetHeight = 1.18; }
    }
    for (const rabbit of rabbits) {
      const distance = rabbit.anchor.position.distanceToSquared(cameraPosition);
      if (distance <= 85 * 85 && distance < best) { nearest = rabbit.anchor; best = distance; targetHeight = .36 + rabbit.body.position.y; }
    }
    if (!nearest) return null;
    focusPosition.set(.025, targetHeight, 0); nearest.localToWorld(focusPosition); return focusPosition;
  };
  animate(0);
  return { animate, focusPoint };
}
