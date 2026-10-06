import type * as Three from 'three';

type Options = {
  resources: Set<Three.BufferGeometry | Three.Material | Three.Texture>;
  isDisposed: () => boolean;
  onReady: () => void;
};

/** Different surface scales for moss, exposed granite, and the worn walking track. */
export function createTrailMaterials(T: typeof import('three'), options: Options) {
  const { resources, isDisposed, onReady } = options;
  const keep = <V extends Three.BufferGeometry | Three.Material | Three.Texture>(v: V): V => { resources.add(v); return v; };
  let seed = 8721;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) | 0; return (seed >>> 0) / 4294967296; };
  const dirtCanvas = document.createElement('canvas'); dirtCanvas.width = dirtCanvas.height = 512;
  const ctx = dirtCanvas.getContext('2d');
  if (ctx) {
    const data = ctx.createImageData(512, 512);
    for (let i = 0; i < 512 * 512; i++) {
      const x = i % 512, y = Math.floor(i / 512);
      const grain = (random() - .5) * 27 + Math.sin(x / 512 * Math.PI * 8) * Math.cos(y / 512 * Math.PI * 6) * 4;
      data.data.set([116 + grain, 100 + grain, 76 + grain * .8, 255], i * 4);
    }
    ctx.putImageData(data, 0, 0);
    for (let i = 0; i < 5600; i++) {
      const x = random() * 512, y = random() * 512, size = .3 + random() ** 3 * 3;
      ctx.fillStyle = ['#877d6b', '#a49b87', '#615a49', '#b6aa90', '#796b52'][i % 5];
      ctx.beginPath(); ctx.ellipse(x, y, size * 1.3, size, random() * Math.PI, 0, Math.PI * 2); ctx.fill();
    }
    for (let i = 0; i < 160; i++) {
      const x = random() * 512, y = random() * 512, angle = random() * Math.PI * 2;
      ctx.strokeStyle = i % 3 ? '#b3a17f60' : '#51473365'; ctx.lineWidth = .55;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.sin(angle) * 15, y + Math.cos(angle) * 15); ctx.stroke();
    }
  }
  const dirt = keep(new T.CanvasTexture(dirtCanvas)); dirt.colorSpace = T.SRGBColorSpace; dirt.wrapS = dirt.wrapT = T.RepeatWrapping; dirt.anisotropy = 8;
  const groundPlaceholder = keep(new T.DataTexture(new Uint8Array([98, 94, 67, 255]), 1, 1)); groundPlaceholder.colorSpace = T.SRGBColorSpace; groundPlaceholder.needsUpdate = true;
  const floor = { value: groundPlaceholder as Three.Texture };
  const soil = { value: dirt as Three.Texture };
  const groundNoise = `
    float groundHash(vec2 p) { return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
    float groundNoise(vec2 p) {
      vec2 i=floor(p),f=fract(p); f=f*f*(3.-2.*f);
      return mix(mix(groundHash(i),groundHash(i+vec2(1.,0.)),f.x),mix(groundHash(i+vec2(0.,1.)),groundHash(i+vec2(1.)),f.x),f.y);
    }
  `;
  const terrain = keep(new T.MeshStandardMaterial({ color: 0xf7f7ed, vertexColors: true, roughness: .98, side: T.DoubleSide }));
  terrain.onBeforeCompile = shader => {
    shader.uniforms.forestFloorMap = floor;
    shader.uniforms.trailSoilMap = soil;
    shader.vertexShader = 'attribute float groundBlend; varying float vGroundBlend; varying vec3 vGroundWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGroundBlend = groundBlend; vGroundWorld = (modelMatrix * vec4(position,1.)).xyz;');
    shader.fragmentShader = 'uniform sampler2D forestFloorMap; uniform sampler2D trailSoilMap; varying float vGroundBlend; varying vec3 vGroundWorld;\n' + groundNoise + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      vec2 groundP = vGroundWorld.xz;
      vec2 rotatedP = mat2(.8,-.6,.6,.8) * groundP;
      vec3 forestA = texture2D(forestFloorMap, groundP * .30).rgb;
      vec3 forestB = texture2D(forestFloorMap, rotatedP * .117 + vec2(.37,.61)).rgb;
      vec3 needleBed = texture2D(trailSoilMap, rotatedP * .29 + vec2(.19,.43)).rgb * vec3(.82,.76,.64);
      float patches = groundNoise(groundP * .052) * .67 + groundNoise(rotatedP * .16 + 17.) * .33;
      float moss = smoothstep(.32,.70,patches);
      float variation = .84 + groundNoise(groundP * .012 + 38.) * .26;
      vec3 livingGround = mix(needleBed, mix(forestA,forestB,.19) * vec3(.98,1.06,.88),.12 + moss * .80) * variation;
      float groundRelief = dot(livingGround,vec3(.3,.59,.11)) * .055;
      diffuseColor.rgb = mix(diffuseColor.rgb, livingGround, vGroundBlend);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <normal_fragment_maps>', `
      #ifdef USE_BUMPMAP
        vec2 surfaceGradient = mix(dHdxy_fwd(),vec2(dFdx(groundRelief),dFdy(groundRelief)),vGroundBlend);
        normal = perturbNormalArb(-vViewPosition,normal,surfaceGradient,faceDirection);
      #endif
    `);
  };
  terrain.customProgramCacheKey = () => 'summit-forest-ground-v5';
  const stone = keep(new T.MeshStandardMaterial({ color: 0xc9c7b9, roughness: .96 }));
  const path = keep(new T.MeshStandardMaterial({ color: 0xe2d8c3, map: dirt, bumpMap: dirt, bumpScale: .035, vertexColors: true, roughness: 1, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1 }));
  path.onBeforeCompile = shader => {
    shader.uniforms.forestFloorMap = floor;
    shader.vertexShader = 'attribute float pathEdge; varying float vPathEdge; varying vec2 vPathWorld;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvPathEdge = pathEdge; vPathWorld = (modelMatrix * vec4(position,1.)).xz;');
    shader.fragmentShader = 'uniform sampler2D forestFloorMap; varying float vPathEdge; varying vec2 vPathWorld;\n' + groundNoise + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <map_fragment>', `
      #include <map_fragment>
      float worn = groundNoise(vPathWorld * vec2(.6,.17));
      float margin = smoothstep(.38,.96,abs(vPathEdge)) * (.25 + worn * .47);
      vec3 scatteredLitter = texture2D(forestFloorMap,vPathWorld * .3).rgb * vec3(.91,.85,.71);
      diffuseColor.rgb = mix(diffuseColor.rgb * (.88 + worn * .24),scatteredLitter,margin);
    `);
    shader.fragmentShader = shader.fragmentShader.replace('#include <alphatest_fragment>', `
      float edgeBreakup = (groundNoise(vPathWorld * 2.1)-.5) * .22 + (groundNoise(vPathWorld * .57)-.5) * .18;
      diffuseColor.a *= 1. - smoothstep(.62,.98,abs(vPathEdge) + edgeBreakup);
      #include <alphatest_fragment>
    `);
  };
  path.customProgramCacheKey = () => 'summit-soft-trail-edge-v3';
  const loader = new T.TextureLoader();
  loader.load('/trail-soil.webp', texture => {
    if (isDisposed()) { texture.dispose(); return; }
    texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 8;
    keep(texture); soil.value = texture; path.map = texture; path.bumpMap = texture; path.needsUpdate = true; onReady();
  }, undefined, () => undefined);
  loader.load('/forest-floor.webp', texture => {
    if (isDisposed()) { texture.dispose(); return; }
    texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 8;
    keep(texture); floor.value = texture; onReady();
  }, undefined, () => undefined);
  loader.load('/granite-albedo.webp', texture => {
    if (isDisposed()) { texture.dispose(); return; }
    texture.colorSpace = T.SRGBColorSpace; texture.wrapS = texture.wrapT = T.RepeatWrapping; texture.anisotropy = 8; keep(texture);
    terrain.map = texture; terrain.bumpMap = texture; terrain.bumpScale = .17; terrain.needsUpdate = true;
    stone.map = texture; stone.bumpMap = texture; stone.bumpScale = .09; stone.needsUpdate = true; onReady();
  }, undefined, () => undefined);
  return { terrain, stone, path };
}
