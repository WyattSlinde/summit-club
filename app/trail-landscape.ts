import type * as Three from 'three';
import { creekX, creekWindow, creekSurface, creekHalfWidth, terrainHeight, trailX, trailHalfWidth } from './trail-terrain';

type Options = {
  mobile: boolean;
  resources: Set<Three.BufferGeometry | Three.Material | Three.Texture>;
  stoneMaterial: Three.MeshStandardMaterial;
  isDisposed: () => boolean;
};
const random = (i: number, seed: number) => { const n = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453; return n - Math.floor(n); };

/** Small-scale geology and a recessed brook make the entrance a place, rather than a flat corridor. */
export function addTrailLandscape(T: typeof import('three'), scene: Three.Scene, { mobile, resources, stoneMaterial, isDisposed }: Options) {
  const keep = <V extends Three.BufferGeometry | Three.Material | Three.Texture>(v: V): V => { resources.add(v); return v; };
  const group = new T.Group(); group.name = 'Forest banks and brook'; scene.add(group);
  const dummy = new T.Object3D(), color = new T.Color();
  const rockGeometries = Array.from({ length: 3 }, (_, variant) => {
    const geometry = keep(new T.IcosahedronGeometry(1, variant === 0 ? 2 : 1));
    const positions = geometry.getAttribute('position'), pigments: number[] = [];
    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i), y = positions.getY(i), z = positions.getZ(i);
      const warp = .88 + Math.sin(x * 5.1 + z * 3.7 + variant * 1.9) * Math.cos(y * 6.3 - z * 2.4) * .16;
      const ledge = Math.max(-.5,y * (.65 + variant * .13) - Math.max(0,x + .1) * .12);
      positions.setXYZ(i,x * warp + y * (.12 - variant * .07),ledge,z * warp * (1.12 - variant * .15));
      const moss = Math.max(0,y - .12) * Math.max(0,Math.sin(x * 7.3 + z * 4.7 + variant));
      color.set(0xb5b4a5).lerp(new T.Color(0x626c42),moss * .68);
      color.multiplyScalar(.81 + (y + 1) * .085);
      pigments.push(color.r,color.g,color.b);
    }
    geometry.setAttribute('color',new T.Float32BufferAttribute(pigments,3)); geometry.computeVertexNormals();
    return geometry;
  });
  const rockMaterial = keep(stoneMaterial.clone()); rockMaterial.vertexColors = true; rockMaterial.color.set(0xe1ded2);
  new T.TextureLoader().load('/granite-albedo.webp', texture => {
    if (isDisposed()) { texture.dispose(); return; }
    keep(texture); texture.colorSpace = T.SRGBColorSpace; texture.anisotropy = 8;
    rockMaterial.map = texture; rockMaterial.bumpMap = texture; rockMaterial.bumpScale = .05; rockMaterial.needsUpdate = true;
  }, undefined, () => undefined);
  const count = mobile ? 210 : 350;
  for (let variant = 0; variant < rockGeometries.length; variant++) {
    const stones = new T.InstancedMesh(rockGeometries[variant],rockMaterial,count);
    for (let i = 0; i < count; i++) {
      const id = i + variant * count, cluster = Math.floor(id / 7);
      const clusterZ = cluster % 3 === 0 ? 680 - random(cluster,71) * 295 : 700 - random(cluster,72) * 2040;
      const z = clusterZ + (random(id,73) - .5) * 7;
      const side = random(cluster,74) > .48 ? 1 : -1;
      const offset = trailHalfWidth(z) + .30 + random(cluster,75) ** 1.7 * 28 + random(id,76) * 2.4;
      const x = trailX(z) + side * offset;
      const size = .055 + random(id,77) ** 2.1 * (offset < 6 ? .4 : 1.15);
      dummy.position.set(x,terrainHeight(x,z) + size * .045,z);
      dummy.rotation.set((random(id,80) - .5) * .55,random(id,81) * Math.PI * 2,(random(id,82) - .5) * .32);
      dummy.scale.set(size * (.72 + random(id,83) * .7),size * (.72 + random(id,84) * .55),size);
      dummy.updateMatrix(); stones.setMatrixAt(i,dummy.matrix);
      const tone = .79 + random(id,85) * .24;
      color.setRGB(tone,tone * (.98 + random(id,86) * .045),tone * (.87 + random(id,87) * .11)); stones.setColorAt(i,color);
    }
    stones.receiveShadow = true; group.add(stones);
  }

  const bedStoneCount = mobile ? 95 : 170, bedStones = new T.InstancedMesh(rockGeometries[1], rockMaterial, bedStoneCount);
  for (let i = 0; i < bedStoneCount; i++) {
    const z = 445 + random(i, 103) * 216, x = creekX(z) + (random(i,105) - .5) * creekHalfWidth(z) * 3.5;
    const size = .07 + random(i, 109) ** 2 * .37;
    dummy.position.set(x, terrainHeight(x, z) + size * .09, z); dummy.rotation.set(random(i, 111) * .3, random(i, 112) * 6, 0); dummy.scale.set(size, size * .72, size * 1.25); dummy.updateMatrix(); bedStones.setMatrixAt(i, dummy.matrix);
  }
  bedStones.receiveShadow = true; group.add(bedStones);

  const rootMaterial = keep(new T.MeshStandardMaterial({ color: 0x78634b, roughness: 1 }));
  for (const [index, z] of [610, 550, 491, 193, 158, -357, -404, -858, -962].entries()) {
    const center = trailX(z), rootPoints: Three.Vector3[] = [];
    for (let j = 0; j < 8; j++) {
      const x = center - 2.5 + j * .71, rz = z + Math.sin(j * .74 + index) * .85 + Math.sin(j * 1.4) * .14;
      rootPoints.push(new T.Vector3(x, terrainHeight(x, rz) + .063, rz));
    }
    const curve = new T.CatmullRomCurve3(rootPoints), geometry = keep(new T.TubeGeometry(curve, 26, .025 + random(index, 129) * .035, 5, false));
    const root = new T.Mesh(geometry, rootMaterial); root.receiveShadow = true; group.add(root);
  }

  const waterPositions: number[] = [], waterUV: number[] = [], waterIndices: number[] = [];
  const segments = mobile ? 145 : 220;
  for (let i = 0; i <= segments; i++) {
    const z = 700 - i / segments * 295, width = creekWindow(z) * creekHalfWidth(z);
    for (let j = 0; j < 5; j++) {
      const edge = j / 4 * 2 - 1;
      waterPositions.push(creekX(z) + edge * width, creekSurface(z), z); waterUV.push(j / 4, z);
      if (i < segments && j < 4) { const a = i * 5 + j; waterIndices.push(a, a + 1, a + 5, a + 1, a + 6, a + 5); }
    }
  }
  const waterGeometry = keep(new T.BufferGeometry()); waterGeometry.setAttribute('position', new T.Float32BufferAttribute(waterPositions, 3)); waterGeometry.setAttribute('uv', new T.Float32BufferAttribute(waterUV, 2)); waterGeometry.setIndex(waterIndices); waterGeometry.computeVertexNormals();
  const time = { value: 0 };
  const waterMaterial = keep(new T.ShaderMaterial({
    transparent: true, depthWrite: false, side: T.DoubleSide, fog: true,
    uniforms: T.UniformsUtils.merge([T.UniformsLib.fog, { uTime: time }]),
    vertexShader: `varying vec3 vWorld; varying vec2 vStream; uniform float uTime;
      #include <fog_pars_vertex>
      void main(){ vec3 p=position; p.y+=sin(position.z*3.4+uTime*2.)*.009; vWorld=(modelMatrix*vec4(p,1.)).xyz; vStream=uv; vec4 mvPosition=modelViewMatrix*vec4(p,1.); gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
      }`,
    fragmentShader: `varying vec3 vWorld; varying vec2 vStream; uniform float uTime;
      #include <fog_pars_fragment>
      void main(){
        vec3 view=normalize(cameraPosition-vWorld);
        float ripple=sin(vWorld.z*6.2-uTime*3.2+sin(vWorld.x*9.))*sin(vWorld.x*12.+vWorld.z*1.4+uTime*1.7);
        vec3 n=normalize(vec3(ripple*.045,1.,cos(vWorld.z*5.-uTime*2.1)*.032));
        float fresnel=pow(1.-max(dot(n,view),0.),3.);
        vec3 water=mix(vec3(.037,.046,.025),vec3(.18,.23,.20),fresnel*.62);
        vec3 halfLight=normalize(normalize(vec3(-.46,.82,-.42))+view);
        float sparkle=pow(max(dot(n,halfLight),0.),190.);
        water+=vec3(.93,.91,.76)*sparkle*.18+vec3(.006,.009,.005)*ripple;
        float edge=smoothstep(0.,.09,vStream.x)*smoothstep(0.,.09,1.-vStream.x);
        gl_FragColor=vec4(water,(.48+fresnel*.17)*edge);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }`,
  }));
  const water = new T.Mesh(waterGeometry, waterMaterial); water.name = 'Shallow forest brook'; water.renderOrder = 2; group.add(water);
  return { animate: (seconds: number) => { waterMaterial.uniforms.uTime.value = seconds; } };
}
