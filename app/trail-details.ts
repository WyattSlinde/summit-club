import type * as Three from 'three';

type TrailDetailsOptions = {
  mobile: boolean;
  terrainHeight: (x: number, z: number) => number;
  trailX: (z: number) => number;
  resources: Set<Three.BufferGeometry | Three.Material | Three.Texture>;
};

const random = (a: number, b: number) => {
  let h = Math.imul(a, 374761393) + Math.imul(b, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};

/** Small, human-scale discoveries along the shared three-dimensional trail. */
export function addTrailDetails(T: typeof import('three'), scene: Three.Scene, options: TrailDetailsOptions) {
  const { mobile, terrainHeight, trailX, resources } = options;
  const details = new T.Group(); details.name = 'Trail discoveries'; scene.add(details);
  const wind = { value: 0 };
  const dummy = new T.Object3D(), color = new T.Color(), up = new T.Vector3(0, 1, 0);
  const register = <V extends Three.BufferGeometry | Three.Material | Three.Texture>(value: V): V => { resources.add(value); return value; };

  function canvasTexture(width: number, height: number, draw: (context: CanvasRenderingContext2D) => void) {
    const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d');
    if (context) draw(context);
    const texture = register(new T.CanvasTexture(canvas)); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 4;
    return texture;
  }

  function addWind(material: Three.MeshStandardMaterial) {
    material.onBeforeCompile = shader => {
      shader.uniforms.trailTime = wind;
      shader.vertexShader = 'uniform float trailTime;\n' + shader.vertexShader;
      shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
        #include <begin_vertex>
        float seed = 0.;
        #ifdef USE_INSTANCING
          seed = instanceMatrix[3].x * .13 + instanceMatrix[3].z * .037;
        #endif
        float movement = max(position.y, 0.);
        transformed.x += sin(trailTime * 1.25 + seed + position.y * 2.4) * .035 * movement;
        transformed.z += cos(trailTime * .91 + seed) * .022 * movement;
      `);
    };
    material.customProgramCacheKey = () => 'summit-trail-foliage-v1';
  }

  const fernTexture = canvasTexture(256, 512, ctx => {
    ctx.lineCap = 'round'; ctx.strokeStyle = '#e0e8cb'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(128, 502); ctx.quadraticCurveTo(134, 254, 125, 13); ctx.stroke();
    for (let i = 0; i < 25; i++) {
      const y = 479 - i * 18.1, length = 81 * Math.pow(Math.sin((i + 2) / 28 * Math.PI), .65);
      for (const side of [-1, 1]) {
        const x = 128 + Math.sin(i * .2) * 2, tip = x + side * length * (.85 + random(i, side + 51) * .2);
        ctx.fillStyle = i % 3 === 0 ? '#ecf0df' : i % 3 === 1 ? '#cbd8b6' : '#dce6c9';
        ctx.beginPath(); ctx.moveTo(x, y);
        for (let tooth = 1; tooth <= 7; tooth++) {
          const t = tooth / 7;
          ctx.lineTo(x + (tip - x) * t, y - t * length * .26 + (tooth % 2 ? 1 : -3));
        }
        ctx.quadraticCurveTo(x + (tip - x) * .53, y - length * .25 - 14, x, y - 11); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = '#f2f3e2'; ctx.lineWidth = .9;
        ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(tip - side * 4, y - length * .26 - 2); ctx.stroke();
      }
    }
  });
  const fernPositions: number[] = [], fernUV: number[] = [], fernIndices: number[] = [];
  for (let frond = 0; frond < 7; frond++) {
    const angle = frond / 7 * Math.PI * 2 + random(frond, 17) * .25;
    const length = .78 + random(frond, 23) * .5, base = fernPositions.length / 3;
    for (let step = 0; step <= 10; step++) {
      const t = step / 10, radial = t * length, height = Math.sin(t * Math.PI) * (.48 + length * .11) + t * .08;
      const width = .19 * Math.pow(Math.sin(t * Math.PI), .6) * length;
      for (const edge of [-1, 1]) {
        fernPositions.push(Math.cos(angle) * radial - Math.sin(angle) * width * edge, height, Math.sin(angle) * radial + Math.cos(angle) * width * edge);
        fernUV.push((edge + 1) / 2, t);
      }
      if (step < 10) { const a = base + step * 2; fernIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const fernGeometry = register(new T.BufferGeometry()); fernGeometry.setAttribute('position', new T.Float32BufferAttribute(fernPositions, 3)); fernGeometry.setAttribute('uv', new T.Float32BufferAttribute(fernUV, 2)); fernGeometry.setIndex(fernIndices); fernGeometry.computeVertexNormals();
  const fernMaterial = register(new T.MeshStandardMaterial({ color: 0x8d9d6e, map: fernTexture, roughness: .93, alphaTest: .28, alphaToCoverage: true, side: T.DoubleSide })); addWind(fernMaterial);
  const fernCount = mobile ? 1250 : 2400, ferns = new T.InstancedMesh(fernGeometry, fernMaterial, fernCount);
  for (let i = 0; i < fernCount; i++) {
    const z = 710 - random(i, 144) * 2100, side = i % 2 ? -1 : 1;
    const pocket = .45 + .55 * Math.sin(z * .016 + side) ** 2;
    const size = .52 + random(i, 162) * .75;
    const x = trailX(z) + side * (3.2 + size * 1.28 + random(i, 150) * 21 * pocket);
    dummy.position.set(x, terrainHeight(x, z) - .065, z); dummy.rotation.set(0, random(i, 164) * Math.PI * 2, (random(i, 166) - .5) * .12); dummy.scale.set(size, size * (.7 + random(i, 168) * .4), size); dummy.updateMatrix(); ferns.setMatrixAt(i, dummy.matrix);
    color.setRGB(.77 + random(i, 180) * .23, .88 + random(i, 181) * .19, .72 + random(i, 182) * .2); ferns.setColorAt(i, color);
  }
  ferns.receiveShadow = true; details.add(ferns);

  const grassPositions: number[] = [], grassColors: number[] = [], grassIndices: number[] = [];
  for (let blade = 0; blade < 11; blade++) {
    const angle = random(blade, 222) * Math.PI * 2, height = .31 + random(blade, 230) * .52;
    const rootX = (random(blade, 235) - .5) * .32, rootZ = (random(blade, 236) - .5) * .32;
    const base = grassPositions.length / 3;
    for (let step = 0; step <= 3; step++) {
      const t = step / 3, width = (1 - t) * (.011 + random(blade, 239) * .012);
      for (const edge of [-1, 1]) {
        grassPositions.push(rootX + Math.cos(angle) * t * t * .24 - Math.sin(angle) * width * edge, t * height, rootZ + Math.sin(angle) * t * t * .24 + Math.cos(angle) * width * edge);
        grassColors.push(.61 + t * .32, .66 + t * .33, .37 + t * .24);
      }
      if (step < 3) { const a = base + step * 2; grassIndices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
  }
  const grassGeometry = register(new T.BufferGeometry()); grassGeometry.setAttribute('position', new T.Float32BufferAttribute(grassPositions, 3)); grassGeometry.setAttribute('color', new T.Float32BufferAttribute(grassColors, 3)); grassGeometry.setIndex(grassIndices); grassGeometry.computeVertexNormals();
  const grassMaterial = register(new T.MeshStandardMaterial({ color: 0x879768, vertexColors: true, side: T.DoubleSide, roughness: .95 })); addWind(grassMaterial);
  const grassCount = mobile ? 3100 : 6600, grasses = new T.InstancedMesh(grassGeometry, grassMaterial, grassCount);
  for (let i = 0; i < grassCount; i++) {
    const z = 730 - random(i, 274) * 2130, side = i % 2 ? 1 : -1;
    const x = trailX(z) + side * (5.8 + Math.pow(random(i, 276), 1.65) * 30);
    const size = .57 + random(i, 282) * .83;
    dummy.position.set(x, terrainHeight(x, z) - .045, z); dummy.rotation.set(0, random(i, 283) * Math.PI * 2, 0); dummy.scale.set(size, size * (.64 + random(i, 285) * .62), size); dummy.updateMatrix(); grasses.setMatrixAt(i, dummy.matrix);
    color.setRGB(.85 + random(i, 286) * .17, .88 + random(i, 287) * .18, .79 + random(i, 288) * .16); grasses.setColorAt(i, color);
  }
  grasses.receiveShadow = true; details.add(grasses);

  const barkTexture = canvasTexture(256, 512, ctx => {
    ctx.fillStyle = '#796d59'; ctx.fillRect(0, 0, 256, 512);
    for (let i = 0; i < 170; i++) {
      const x = random(i, 311) * 256, y = random(i, 312) * 512;
      ctx.strokeStyle = i % 4 === 0 ? '#a3987d' : i % 3 === 0 ? '#564d3e' : '#6b614f'; ctx.lineWidth = .5 + random(i, 313) * 3.3;
      ctx.beginPath(); ctx.moveTo(x, y - 45); ctx.bezierCurveTo(x + 5, y, x - 6, y + 55, x + random(i, 318) * 7, y + 140); ctx.stroke();
    }
    for (let i = 0; i < 40; i++) { ctx.fillStyle = '#8b8e6d55'; ctx.beginPath(); ctx.ellipse(random(i, 321) * 256, random(i, 322) * 512, 4 + random(i, 323) * 9, 2 + random(i, 324) * 4, random(i, 325) * 3, 0, Math.PI * 2); ctx.fill(); }
  });
  const endTexture = canvasTexture(256, 256, ctx => {
    ctx.fillStyle = '#b4a17b'; ctx.fillRect(0, 0, 256, 256);
    for (let ring = 1; ring <= 23; ring++) {
      ctx.strokeStyle = ring % 3 ? '#79674766' : '#66553880'; ctx.lineWidth = ring % 4 === 0 ? 2 : .8;
      ctx.beginPath();
      for (let step = 0; step <= 80; step++) {
        const a = step / 80 * Math.PI * 2, r = ring * 5.6 + Math.sin(a * 3 + ring * .2) * 2;
        const x = 128 + Math.cos(a) * r, y = 128 + Math.sin(a) * r * .94;
        if (!step) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.strokeStyle = '#5e4c36'; ctx.lineWidth = 1.5;
    for (let crack = 0; crack < 5; crack++) { const a = random(crack, 367) * Math.PI * 2; ctx.beginPath(); ctx.moveTo(128 + Math.cos(a) * 126, 128 + Math.sin(a) * 126); ctx.lineTo(128 + Math.cos(a + .025) * 79, 128 + Math.sin(a + .025) * 79); ctx.lineTo(128 + Math.cos(a) * 51, 128 + Math.sin(a) * 51); ctx.stroke(); }
  });
  const barkMaterial = register(new T.MeshStandardMaterial({ color: 0xc2b6a1, map: barkTexture, bumpMap: barkTexture, bumpScale: .035, roughness: 1 }));
  const endMaterial = register(new T.MeshStandardMaterial({ color: 0xddd0ad, map: endTexture, roughness: .95 }));
  const timberGeometry = register(new T.CylinderGeometry(1, 1.045, 1, 11, 2));
  const logCount = mobile ? 9 : 15, logs = new T.InstancedMesh(timberGeometry, [barkMaterial, endMaterial, endMaterial], logCount);
  const branchGeometry = register(new T.CylinderGeometry(.018, .075, 1, 5));
  const branches = new T.InstancedMesh(branchGeometry, barkMaterial, logCount * 2);
  const direction = new T.Vector3();
  for (let i = 0; i < logCount; i++) {
    const z = 570 - i / logCount * 1850 + random(i, 382) * 55, side = i % 2 ? 1 : -1;
    const x = trailX(z) + side * (9 + random(i, 384) * 13), length = 3.4 + random(i, 385) * 4.8, radius = .17 + random(i, 386) * .25;
    const dx = (trailX(z + 6) - trailX(z - 6)) / 12 + (random(i, 387) - .5) * .6;
    direction.set(dx, 0, 1).normalize();
    const y1 = terrainHeight(x - direction.x * length * .5, z - direction.z * length * .5), y2 = terrainHeight(x + direction.x * length * .5, z + direction.z * length * .5);
    direction.y = (y2 - y1) / length; direction.normalize();
    const y = (y1 + y2) * .5 + radius * .65;
    dummy.position.set(x, y, z); dummy.quaternion.setFromUnitVectors(up, direction); dummy.scale.set(radius, length, radius); dummy.updateMatrix(); logs.setMatrixAt(i, dummy.matrix);
    for (let branch = 0; branch < 2; branch++) {
      const along = (branch ? .24 : -.31) * length;
      dummy.position.set(x + direction.x * along, y + radius * .5 + direction.y * along, z + direction.z * along);
      dummy.rotation.set(.4 + random(i, branch + 391) * .6, random(i, branch + 396) * 6, (branch ? 1 : -1) * .8); dummy.scale.set(1, .6 + random(i, branch + 400) * .7, 1); dummy.updateMatrix(); branches.setMatrixAt(i * 2 + branch, dummy.matrix);
    }
  }
  logs.castShadow = logs.receiveShadow = true; branches.castShadow = true; details.add(logs, branches);
  const stumps = new T.InstancedMesh(timberGeometry, [barkMaterial, endMaterial, endMaterial], 7);
  for (let i = 0; i < 7; i++) {
    const z = 480 - i * 255, x = trailX(z) + (i % 2 ? -1 : 1) * (7.2 + random(i, 411) * 9), height = .47 + random(i, 412) * .63, radius = .22 + random(i, 413) * .18;
    dummy.position.set(x, terrainHeight(x, z) + height * .5 - .04, z); dummy.rotation.set(.03, random(i, 415) * 6, -.025); dummy.scale.set(radius, height, radius); dummy.updateMatrix(); stumps.setMatrixAt(i, dummy.matrix);
  }
  stumps.castShadow = stumps.receiveShadow = true; details.add(stumps);

  const pebbleGeometry = register(new T.IcosahedronGeometry(1, 2));
  const stonePositions = pebbleGeometry.getAttribute('position'), stoneNormals = pebbleGeometry.getAttribute('normal');
  for (let i = 0; i < stonePositions.count; i++) {
    const x = stonePositions.getX(i), y = stonePositions.getY(i), z = stonePositions.getZ(i), r = .94 + Math.sin(x * 8 + y * 4) * Math.cos(z * 7 - x * 3) * .085;
    stonePositions.setXYZ(i, x * r, y * r, z * r); const n = Math.hypot(x, y, z); stoneNormals.setXYZ(i, x / n, y / n, z / n);
  }
  const pebbleTexture = canvasTexture(128, 128, ctx => {
    const pixels = ctx.createImageData(128, 128);
    for (let i = 0; i < 128 * 128; i++) { const shade = 155 + Math.floor(random(i, 440) * 71); pixels.data.set([shade, shade + 2, shade - 5, 255], i * 4); }
    ctx.putImageData(pixels, 0, 0);
  });
  const pebbleMaterial = register(new T.MeshStandardMaterial({ color: 0xc0c4b7, map: pebbleTexture, bumpMap: pebbleTexture, bumpScale: .022, roughness: .98 }));
  const cairns = new T.InstancedMesh(pebbleGeometry, pebbleMaterial, 24);
  const cairnZ = [540, 112, -210, -578, -925, -1190];
  for (let pile = 0; pile < cairnZ.length; pile++) {
    const z = cairnZ[pile], x = trailX(z) + (pile % 2 ? 1 : -1) * 6.6;
    let y = terrainHeight(x, z) - .03;
    for (let stone = 0; stone < 4; stone++) {
      const radius = .53 - stone * .09, halfHeight = radius * (.34 + random(stone, pile + 468) * .13);
      dummy.position.set(x + Math.sin(stone + pile) * .055, y + halfHeight, z + Math.cos(stone * 2 + pile) * .055);
      dummy.rotation.set((random(stone, pile + 471) - .5) * .16, random(stone, pile + 474) * 6, 0); dummy.scale.set(radius, halfHeight, radius * .73); dummy.updateMatrix(); cairns.setMatrixAt(pile * 4 + stone, dummy.matrix);
      color.setRGB(.85 + random(stone, pile + 476) * .15, .86 + random(stone, pile + 478) * .14, .80 + random(stone, pile + 480) * .13); cairns.setColorAt(pile * 4 + stone, color);
      y += halfHeight * 1.73;
    }
  }
  cairns.castShadow = cairns.receiveShadow = true; details.add(cairns);

  const postGeometry = register(new T.BoxGeometry(.18, 3.0, .18));
  const boardGeometry = register(new T.BoxGeometry(3.1, .79, .13, 12, 2, 1));
  const boardPositions = boardGeometry.getAttribute('position');
  for (let i = 0; i < boardPositions.count; i++) { const x = boardPositions.getX(i), y = boardPositions.getY(i), z = boardPositions.getZ(i); boardPositions.setY(i, y + Math.sin(x * 11 + z * 7) * .007 + Math.cos(x * 23) * .004); }
  boardGeometry.computeVertexNormals();
  const nailGeometry = register(new T.SphereGeometry(.026, 6, 4)), nailMaterial = register(new T.MeshStandardMaterial({ color: 0x50524a, roughness: .78, metalness: .3 }));
  const markerLocations: Array<[number, string, number]> = [[165, 'EXPLORE', 1], [-420, 'SERVE', -1], [-930, 'LEAD', 1]];
  markerLocations.forEach(([z, label, side], index) => {
    const x = trailX(z) + side * 7.3, y = terrainHeight(x, z), marker = new T.Group();
    marker.name = `${label} trail marker`; marker.position.set(x, y, z);
    marker.rotation.y = Math.atan2(trailX(z + 65) - x, 65);
    const boardTexture = canvasTexture(1024, 256, ctx => {
      ctx.fillStyle = '#695d43'; ctx.fillRect(0, 0, 1024, 256);
      for (let grain = 0; grain < 115; grain++) {
        const gy = random(grain, index + 507) * 256;
        ctx.strokeStyle = grain % 3 === 0 ? '#ac9a7166' : '#382f2355'; ctx.lineWidth = .5 + random(grain, index + 510) * 2;
        ctx.beginPath(); ctx.moveTo(0, gy); ctx.bezierCurveTo(280, gy + 7, 670, gy - 8, 1024, gy + 3); ctx.stroke();
      }
      ctx.fillStyle = '#eee8d3'; ctx.textBaseline = 'middle'; ctx.font = '700 126px Arial, sans-serif'; ctx.fillText(label, 73, 123, 808);
      ctx.font = '500 24px Arial, sans-serif'; ctx.fillStyle = '#d5cfb9'; ctx.fillText('SUMMIT  /  CATHEDRAL CATHOLIC', 80, 216);
      ctx.font = '500 27px monospace'; ctx.textAlign = 'right'; ctx.fillText(`0${index + 1}`, 948, 44);
      for (let scratch = 0; scratch < 26; scratch++) { const sx = random(scratch, index + 521) * 1024, sy = random(scratch, index + 523) * 256; ctx.strokeStyle = '#312d2424'; ctx.lineWidth = .7; ctx.beginPath(); ctx.moveTo(sx, sy); ctx.lineTo(sx + 22 + random(scratch, 529) * 60, sy - 2); ctx.stroke(); }
    });
    const letteringMaterial = register(new T.MeshStandardMaterial({ color: 0xf2ecdc, map: boardTexture, roughness: .93 }));
    const post = new T.Mesh(postGeometry, barkMaterial); post.position.y = 1.45; post.castShadow = post.receiveShadow = true;
    const board = new T.Mesh(boardGeometry, [barkMaterial, barkMaterial, barkMaterial, barkMaterial, letteringMaterial, barkMaterial]); board.position.set(0, 2.45, .055); board.castShadow = board.receiveShadow = true;
    marker.add(post, board);
    for (const nx of [-1.38, 1.38]) for (const ny of [2.16, 2.73]) { const nail = new T.Mesh(nailGeometry, nailMaterial); nail.position.set(nx, ny, .133); nail.scale.z = .38; marker.add(nail); }
    details.add(marker);
  });

  const birdWingGeometry = register(new T.BufferGeometry());
  birdWingGeometry.setAttribute('position', new T.Float32BufferAttribute([0, 0, -.03, .31, .015, -.09, .83, 0, -.24, .64, 0, .13, .22, 0, .22, 0, 0, .18], 3)); birdWingGeometry.setIndex([0, 1, 4, 1, 2, 3, 1, 3, 4, 0, 4, 5]); birdWingGeometry.computeVertexNormals();
  const otherWingGeometry = register(birdWingGeometry.clone()); otherWingGeometry.scale(-1, 1, 1);
  const bodyGeometry = register(new T.SphereGeometry(1, 7, 5));
  const birdMaterial = register(new T.MeshStandardMaterial({ color: 0x374035, roughness: .94, side: T.DoubleSide }));
  const birdCount = mobile ? 4 : 6;
  const birds = new T.InstancedMesh(bodyGeometry, birdMaterial, birdCount), leftWings = new T.InstancedMesh(birdWingGeometry, birdMaterial, birdCount), rightWings = new T.InstancedMesh(otherWingGeometry, birdMaterial, birdCount);
  for (const mesh of [birds, leftWings, rightWings]) { mesh.instanceMatrix.setUsage(T.DynamicDrawUsage); mesh.frustumCulled = false; details.add(mesh); }
  const birdRoot = new T.Object3D(), bodyPose = new T.Object3D(), leftPose = new T.Object3D(), rightPose = new T.Object3D();
  bodyPose.scale.set(.11, .085, .34); leftPose.position.x = .055; rightPose.position.x = -.055; birdRoot.add(bodyPose, leftPose, rightPose);

  const pollenCount = mobile ? 100 : 180, pollenBase = new Float32Array(pollenCount * 3), pollenPositions = new Float32Array(pollenCount * 3);
  for (let i = 0; i < pollenCount; i++) { const z = 670 - random(i, 581) * 1980, x = trailX(z) + (random(i, 582) - .5) * 35; pollenBase.set([x, terrainHeight(x, z) + 1 + random(i, 583) * 4.5, z], i * 3); }
  pollenPositions.set(pollenBase);
  const pollenGeometry = register(new T.BufferGeometry()); pollenGeometry.setAttribute('position', new T.BufferAttribute(pollenPositions, 3).setUsage(T.DynamicDrawUsage));
  const pollenTexture = canvasTexture(32, 32, ctx => { const glow = ctx.createRadialGradient(16, 16, 1, 16, 16, 15); glow.addColorStop(0, '#ffffff'); glow.addColorStop(.4, '#ffffffb3'); glow.addColorStop(1, '#ffffff00'); ctx.fillStyle = glow; ctx.fillRect(0, 0, 32, 32); });
  const pollenMaterial = register(new T.PointsMaterial({ color: 0xe0dfc1, size: .06, map: pollenTexture, transparent: true, opacity: .33, depthWrite: false, sizeAttenuation: true }));
  const pollen = new T.Points(pollenGeometry, pollenMaterial); details.add(pollen);

  const animate = (timeSeconds: number) => {
    wind.value = timeSeconds;
    for (let i = 0; i < birdCount; i++) {
      const baseZ = 440 - i * 300, phase = timeSeconds * (.065 + i * .004) + i * 1.6;
      const z = baseZ + Math.cos(phase) * 27, x = trailX(baseZ) + Math.sin(phase) * (43 + i * 4);
      birdRoot.position.set(x, terrainHeight(trailX(baseZ), baseZ) + 34 + i * 4 + Math.sin(phase * 2) * 3, z);
      birdRoot.rotation.set(0, Math.atan2(Math.cos(phase) * (43 + i * 4), -Math.sin(phase) * 27), Math.sin(phase) * .13); birdRoot.scale.setScalar(1.05 + i * .06);
      const flap = .17 + Math.sin(timeSeconds * (5.2 + i * .12) + i) * .36;
      leftPose.rotation.z = flap; rightPose.rotation.z = -flap; birdRoot.updateMatrixWorld(true);
      birds.setMatrixAt(i, bodyPose.matrixWorld); leftWings.setMatrixAt(i, leftPose.matrixWorld); rightWings.setMatrixAt(i, rightPose.matrixWorld);
    }
    birds.instanceMatrix.needsUpdate = leftWings.instanceMatrix.needsUpdate = rightWings.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < pollenCount; i++) { pollenPositions[i * 3] = pollenBase[i * 3] + Math.sin(timeSeconds * .24 + i) * .48; pollenPositions[i * 3 + 1] = pollenBase[i * 3 + 1] + Math.sin(timeSeconds * .31 + i * .4) * .32; }
    pollenGeometry.getAttribute('position').needsUpdate = true;
  };
  animate(0);
  return { animate };
}
