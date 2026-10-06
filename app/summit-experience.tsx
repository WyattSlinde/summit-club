'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, Plus, ChevronLeft, ChevronRight, Compass, Binoculars } from 'lucide-react';
import type * as Three from 'three';
import { addTrailDetails } from './trail-details';
import { addTrailWildlife } from './trail-wildlife';
import { addTrailForest } from './trail-forest';
import { createTrailMaterials } from './trail-materials';
import { terrainHeight, trailHeight, trailX, trailHalfWidth, terrainRows, terrainColumns } from './trail-terrain';
import { addTrailLandscape } from './trail-landscape';
import { addTrailUnderstory } from './trail-understory';
import { JOURNEY_VIEWPORTS, trailJourney, walkerEyeHeight } from './trail-journey';
import './summit-experience.css';

const clamp = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (a: number, b: number, n: number) => { const t = clamp((n - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a: number, b: number, t: number) => a + (b - a) * t;
const hash = (x: number, y: number) => {
  let h = Math.imul(x, 374761393) + Math.imul(y, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
};
const noise = (x: number, y: number) => {
  const ix = Math.floor(x), iy = Math.floor(y), u = x - ix, v = y - iy;
  const sx = u * u * (3 - 2 * u), sy = v * v * (3 - 2 * v);
  return mix(mix(hash(ix, iy), hash(ix + 1, iy), sx), mix(hash(ix, iy + 1), hash(ix + 1, iy + 1), sx), sy) * 2 - 1;
};
const trailStops = [
  { name: 'Explore', title: 'Find your kind of outside.', copy: 'Hikes, coastal adventures, and new experiences. Every Cathedral Catholic student is welcome. No experience needed.', at: .18, start: .12, end: .265 },
  { name: 'Serve', title: 'Leave it better.', copy: 'Beach cleanups, trail projects, and helping our community. Adventure means more when we give something back.', at: .36, start: .29, end: .435 },
  { name: 'Lead', title: 'Make the next move.', copy: 'Pitch an idea. Help choose the adventure. Plan it with your crew. This is a club students help create.', at: .54, start: .465, end: .62 },
];

type Props = { onJoin: () => void; children: ReactNode; onReveal?: (visible: boolean) => void };

export default function SummitExperience({ onJoin, children, onReveal }: Props) {
  const shellRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const visualRef = useRef<HTMLDivElement>(null);
  const underlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const enterRef = useRef<() => void>(() => undefined);
  const turnRef = useRef<(delta: number | null) => void>(() => undefined);
  const zoomRef = useRef<() => void>(() => undefined);
  const [closeView, setCloseView] = useState(false);
  const stopRef = useRef<(p: number) => void>(() => undefined);
  const revealRef = useRef(onReveal);
  const [ready, setReady] = useState(false);
  const [simple, setSimple] = useState(false);
  const [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState<'opening' | 'climbing' | 'summit' | 'revealed'>('opening');
  const [stop, setStop] = useState(-1);
  const [walking, setWalking] = useState(true);
  const [underlayVisible, setUnderlayVisible] = useState(false);

  useEffect(() => { revealRef.current = onReveal; }, [onReveal]);
  useEffect(() => {
    const shell = shellRef.current, stage = stageRef.current, visual = visualRef.current, underlay = underlayRef.current, canvas = canvasRef.current;
    if (!shell || !stage || !visual || !underlay || !canvas) return;
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let readyScene = false;
    let disposed = false, fallback = false, frame = 0, resizeFrame = 0, focusFrame = 0, initialHashFrame = 0, lastTime = 0, sceneryTime = 0;
    let focusClubAfterArrival = false;
    let start = 0, runway = 1, target = 0, progress = 0, inView = true;
    let pointerX = 0, pointerY = 0, lookX = 0, lookY = 0, manualYaw = 0;
    let drag: { id: number; x: number; y: number; yaw: number; pitch: number } | null = null;
    let zooming = false, focusMix = 0;
    let focusAt: Three.Vector3 | null = null;
    let focusWildlife: ((position: Three.Vector3) => Three.Vector3 | null) | undefined;
    let aim: Three.Vector3 | undefined;
    let sceneDirty = true, renderedZ = NaN, renderedYaw = NaN, renderedZoom = NaN;
    const endCloseView = () => { if (zooming) { zooming = false; setCloseView(false); } };
    let previousStop = -2;
    let previousWalking: boolean | undefined;
    let details: { animate: (seconds: number) => void } | undefined;
    let previousPhase = '', previousRevealed: boolean | undefined, previousUnderlay: boolean | undefined;
    let renderer: Three.WebGLRenderer | undefined, scene: Three.Scene | undefined, camera: Three.PerspectiveCamera | undefined;
    let left: Three.Group | undefined, right: Three.Group | undefined, trail: Three.Mesh | undefined, sky: Three.Mesh | undefined;
    let skyMaterial: Three.ShaderMaterial | undefined, trailMaterial: Three.MeshStandardMaterial | undefined, light: Three.DirectionalLight | undefined;
    const resources = new Set<Three.BufferGeometry | Three.Material | Three.Texture>();
    const queue = () => { if (!frame && !disposed && !document.hidden) frame = requestAnimationFrame(paint); };
    const invalidate = () => { sceneDirty = true; queue(); };
    const isSimple = () => motion.matches || fallback;
    const readScroll = () => {
      const nextTarget = isSimple() ? 0 : clamp((scrollY - start) / Math.max(1, runway));
      if (Math.abs(nextTarget - target) > .003) endCloseView();
      target = nextTarget;
      inView = scrollY + innerHeight >= start && scrollY <= start + shell.offsetHeight;
      queue();
    };
    const measure = () => {
      if (disposed) return;
      const staticMode = isSimple();
      const vh = staticMode ? innerHeight : visual.clientHeight;
      runway = staticMode ? 0 : vh * JOURNEY_VIEWPORTS;
      shell.style.setProperty('--sx-runway', `${runway}px`);
      shell.dataset.runway = String(Math.round(runway));
      start = shell.getBoundingClientRect().top + scrollY;
      if (renderer && camera) {
        renderer.setSize(visual.clientWidth, visual.clientHeight, false);
        camera.aspect = visual.clientWidth / visual.clientHeight;
        camera.updateProjectionMatrix();
        sceneDirty = true;
      }
      if (staticMode) { target = 0; queue(); } else readScroll();
    };
    const goToClub = (immediate = false) => {
      measure();
      endCloseView();
      focusClubAfterArrival = true;
      const y = underlay.getBoundingClientRect().top + scrollY;
      if (location.hash !== '#basecamp') history.pushState(null, '', '#basecamp');
      scrollTo({ top: Math.max(0, y), behavior: immediate || motion.matches ? 'instant' : 'smooth' });
      queue();
    };
    zoomRef.current = () => {
      if (isSimple() || !camera || target >= .67) return;
      zooming = !zooming;
      if (zooming) focusAt = focusWildlife?.(camera.position)?.clone() || null;
      setCloseView(zooming); queue();
    };
    enterRef.current = () => goToClub();
    stopRef.current = (p) => {
      manualYaw = 0; pointerX = 0; pointerY = 0;
      measure(); scrollTo({ top: start + runway * p, behavior: motion.matches ? 'instant' : 'smooth' });
    };
    turnRef.current = (delta) => {
      endCloseView();
      manualYaw = delta === null ? 0 : Math.max(-1.5, Math.min(1.5, manualYaw + delta));
      pointerX = 0; pointerY = 0; queue();
    };
    const enterEvent = () => goToClub();
    const hashChanged = () => {
      if (location.hash === '#basecamp') goToClub(true);
      if (location.hash === '#home') {
        endCloseView(); focusClubAfterArrival = false;
        manualYaw = pointerX = pointerY = lookX = lookY = 0;
        measure(); scrollTo({ top: start, behavior: 'instant' }); queue();
      }
    };
    const readMotion = () => {
      if (isSimple()) { endCloseView(); focusMix = 0; focusAt = null; }
      setSimple(isSimple());
      shell.classList.toggle('sx-simple', isSimple());
      cancelAnimationFrame(resizeFrame);
      resizeFrame = requestAnimationFrame(measure);
      queue();
    };
    const look = (event: PointerEvent) => {
      if (isSimple() || !inView || target >= .84) return;
      if (drag && drag.id === event.pointerId) {
        const dx = event.clientX - drag.x, dy = event.clientY - drag.y;
        if (Math.abs(dx) > Math.abs(dy) || event.pointerType === 'mouse') {
          manualYaw = Math.max(-1.5, Math.min(1.5, drag.yaw - dx * .006));
          if (event.pointerType === 'mouse') pointerY = Math.max(-.7, Math.min(.7, drag.pitch + dy * .004));
          pointerX = 0; queue();
        }
        return;
      }
    };
    const beginLook = (event: PointerEvent) => {
      if (isSimple() || !inView || target >= .84 || event.button > 0) return;
      if (event.target instanceof Element && event.target.closest('button,a,input')) return;
      endCloseView();
      drag = { id: event.pointerId, x: event.clientX, y: event.clientY, yaw: manualYaw, pitch: pointerY };
      stage.classList.add('sx-dragging');
    };
    const finishLook = () => { drag = null; stage.classList.remove('sx-dragging'); };
    const resetLook = () => { pointerX = 0; pointerY = 0; finishLook(); queue(); };
    const resume = () => { if (!document.hidden) measure(); };
    const fail = () => {
      if (disposed) return;
      clearTimeout(loadingDeadline);
      fallback = true;
      setFailed(true);
      setReady(true);
      readMotion();
    };
    const contextLost = (event: Event) => { event.preventDefault(); fail(); };

    function paint(time: number) {
      frame = 0;
      if (disposed || !stage || !shell || document.hidden) return;
      const desiredYaw = Math.max(-1.7, Math.min(1.7, manualYaw + pointerX * .22));
      const cameraMoving = Math.abs(target - progress) > .0003 || Math.abs(desiredYaw - lookX) > .002 || Math.abs(pointerY - lookY) > .002;
      // Walking has no clock or inertia. Only explicit look/zoom controls ease.
      if (readyScene && !cameraMoving && time - lastTime < (innerWidth < 750 ? 40 : 32)) { queue(); return; }
      const dt = Math.min((time - lastTime) / 1000 || .016, .05);
      lastTime = time;
      const damping = 1 - Math.exp(-dt * 9);
      progress = target;
      focusMix += ((zooming ? 1 : 0) - focusMix) * damping;
      lookX += (desiredYaw - lookX) * damping;
      lookY += (pointerY - lookY) * damping;
      const staticMode = isSimple(), p = progress;
      const journey = trailJourney(p, staticMode);
      shell.style.setProperty('--sx-intro', String(journey.intro));
      shell.style.setProperty('--sx-title', String(journey.title));
      shell.style.setProperty('--sx-ui', String(journey.controls));
      shell.style.setProperty('--sx-title-y', `${(1 - smooth(.70, .76, p)) * 24}px`);
      shell.style.setProperty('--sx-camp', String(journey.camp));
      shell.style.setProperty('--sx-shadow', String(journey.shade));
      shell.dataset.journeyProgress = p.toFixed(3);
      shell.dataset.lookAngle = String(Math.round(lookX * 180 / Math.PI));
      shell.style.setProperty('--sx-distance', `${journey.walk * 100}%`);
      const nextStop = staticMode ? -1 : trailStops.findIndex(item => p >= item.start && p < item.end);
      if (nextStop !== previousStop) { previousStop = nextStop; setStop(nextStop); }
      const isWalking = journey.exploring;
      if (isWalking !== previousWalking) { previousWalking = isWalking; setWalking(isWalking); }
      const nextPhase = journey.phase;
      if (nextPhase !== previousPhase) { previousPhase = nextPhase; setPhase(nextPhase); }
      const revealed = journey.navigation;
      if (revealed !== previousRevealed) { previousRevealed = revealed; revealRef.current?.(revealed); }
      const accessible = journey.accessible;
      if (accessible !== previousUnderlay) { previousUnderlay = accessible; setUnderlayVisible(accessible); }
      if (accessible && focusClubAfterArrival) {
        focusClubAfterArrival = false;
        focusFrame = requestAnimationFrame(() => {
          const destination = underlay?.querySelector<HTMLElement>('#basecamp');
          if (destination && underlay && !underlay.inert) { destination.tabIndex = -1; destination.focus({ preventScroll: true }); }
        });
      }

      if (!fallback && inView && renderer && scene && camera && left && right && sky && skyMaterial && light && trail && trailMaterial) {
        const z = journey.z;
        const x = trailX(z);
        const eye = walkerEyeHeight(terrainHeight(x, z), journey.walk, staticMode);
        camera.position.set(x, eye, z);
        const ahead = 24;
        const trailYaw = Math.atan2(trailX(z - ahead) - x, ahead);
        const lookFreedom = journey.lookFreedom;
        const yaw = trailYaw + (staticMode ? 0 : lookX * lookFreedom);
        if (zooming && focusAt) {
          const movingAnimal = focusWildlife?.(camera.position);
          if (movingAnimal) focusAt.lerp(movingAnimal, damping);
        }
        const pitch = Math.atan2(trailHeight(z - ahead) - trailHeight(z), ahead) * (1 - smooth(.88, 1, journey.walk));
        aim?.set(x + Math.sin(yaw) * 150, eye + Math.tan(pitch) * 150 - (staticMode ? 0 : lookY * 15 * lookFreedom), z - Math.cos(yaw) * 150);
        if (aim && focusAt && focusMix > .001) aim.lerp(focusAt, focusMix);
        if (aim) camera.lookAt(aim);
        const baseFov = innerWidth < 750 ? 68 : 62, nextFov = baseFov + (24 - baseFov) * focusMix;
        if (Math.abs(camera.fov - nextFov) > .015) { camera.fov = nextFov; camera.updateProjectionMatrix(); }
        shell.dataset.closeView = zooming ? 'true' : 'false';
        shell.dataset.cameraZ = z.toFixed(3);
        sky.position.copy(camera.position);
        skyMaterial.uniforms.uOpacity.value = 1;
        light.position.set(x - 1150, eye + 2200, z - 1750);
        light.target.position.set(x, eye - 3, z - 20);
        const ambient = !staticMode && p < .94;
        if (sceneDirty || ambient || z !== renderedZ || yaw !== renderedYaw || focusMix !== renderedZoom) {
          if (ambient) sceneryTime = time / 1000;
          details?.animate(staticMode ? 0 : sceneryTime);
          renderer.render(scene, camera);
          sceneDirty = false; renderedZ = z; renderedYaw = yaw; renderedZoom = focusMix;
        }
      }
      if (Math.abs(desiredYaw - lookX) > .002 || Math.abs(pointerY - lookY) > .002 || Math.abs((zooming ? 1 : 0) - focusMix) > .002 || (!staticMode && readyScene && inView && p < .94)) queue();
    }

    async function buildScene() {
      try {
        const T = await import('three');
        if (disposed || fallback) return;
        renderer = new T.WebGLRenderer({ canvas: canvas!, alpha: true, antialias: true, powerPreference: 'high-performance' });
        const mobile = innerWidth < 750;
        renderer.setPixelRatio(Math.min(devicePixelRatio, mobile ? 1.4 : 1.65));
        renderer.outputColorSpace = T.SRGBColorSpace;
        renderer.toneMapping = T.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.18;
        renderer.setClearColor(0x000000, 0);
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = T.PCFSoftShadowMap;
        scene = new T.Scene();
        scene.fog = new T.FogExp2(0xcce4d9, .00020);
        aim = new T.Vector3();
        camera = new T.PerspectiveCamera(mobile ? 68 : 62, 1, .65, 16000);
        scene.add(new T.HemisphereLight(0xe6f4ff, 0x827c63, 2.4));
        light = new T.DirectionalLight(0xffedcc, 3.2);
        light.castShadow = true;
        light.shadow.mapSize.set(mobile ? 1024 : 2048, mobile ? 1024 : 2048);
        light.shadow.camera.left = -82;
        light.shadow.camera.right = 82;
        light.shadow.camera.top = 82;
        light.shadow.camera.bottom = -82;
        light.shadow.camera.near = 100;
        light.shadow.camera.far = 4400;
        light.shadow.bias = -.00007;
        light.shadow.normalBias = .055;
        scene.add(light, light.target);

        skyMaterial = new T.ShaderMaterial({
          side: T.BackSide, depthWrite: false, depthTest: true, transparent: true,
          uniforms: { uOpacity: { value: 1 }, uSun: { value: new T.Vector3(-.5, .58, -.72).normalize() } },
          vertexShader: 'varying vec3 vDirection; void main(){vDirection=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
          fragmentShader: `varying vec3 vDirection; uniform float uOpacity; uniform vec3 uSun;
            float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
            float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+1.),f.x),f.y);}
            void main(){vec3 d=normalize(vDirection);float y=max(d.y,0.);vec3 c=mix(vec3(.84,.94,.94),vec3(.34,.68,.91),pow(y,.55));float s=max(dot(d,uSun),0.);c+=vec3(.29,.20,.09)*pow(s,15.)+vec3(1.,.84,.59)*pow(s,2600.);vec2 q=d.xz/max(d.y+.18,.13)*2.;float cloud=n(q)*.55+n(q*2.1)*.28+n(q*4.2)*.17;c=mix(c,vec3(.98,.98,.95),smoothstep(.54,.73,cloud)*smoothstep(.02,.3,y)*.48);gl_FragColor=vec4(c,uOpacity);}`,
        });
        resources.add(skyMaterial);
        const skyGeometry = new T.SphereGeometry(13000, 48, 24); resources.add(skyGeometry);
        sky = new T.Mesh(skyGeometry, skyMaterial); sky.renderOrder = -20; sky.frustumCulled = false; scene.add(sky);

        const materials = createTrailMaterials(T, { resources, isDisposed: () => disposed, onReady: invalidate });
        const rockMaterial = materials.terrain, boulderMaterial = materials.stone;
        trailMaterial = materials.path;
        left = new T.Group(); right = new T.Group(); scene.add(left, right);
        const columns = terrainColumns(mobile), nx = columns.length - 1, rows = terrainRows(mobile), nz = rows.length - 1;
        const grass = new T.Color(0xe4e9d3), granite = new T.Color(0xd3d4cb), darkGranite = new T.Color(0x969d95), snow = new T.Color(0xe7e7dc), color = new T.Color();

        for (const side of [-1, 1]) {
          const positions = new Float32Array((nx + 1) * (nz + 1) * 3), uv = new Float32Array((nx + 1) * (nz + 1) * 2);
          const indices: number[] = [];
          for (let iz = 0; iz <= nz; iz++) {
            const z = rows[iz];
            for (let ix = 0; ix <= nx; ix++) {
              const x = trailX(z) + side * columns[ix];
              const i = iz * (nx + 1) + ix;
              positions[i * 3] = x; positions[i * 3 + 1] = terrainHeight(x, z); positions[i * 3 + 2] = z;
              uv[i * 2] = x / 80; uv[i * 2 + 1] = z / 80;
              if (ix < nx && iz < nz) {
                const a = i, b = i + 1, c = i + nx + 1, d = c + 1;
                if (side > 0) indices.push(a, b, c, b, d, c); else indices.push(a, c, b, b, c, d);
              }
            }
          }
          const geometry = new T.BufferGeometry();
          geometry.setAttribute('position', new T.BufferAttribute(positions, 3));
          geometry.setAttribute('uv', new T.BufferAttribute(uv, 2)); geometry.setIndex(indices); geometry.computeVertexNormals();
          const normals = geometry.getAttribute('normal'), colors = new Float32Array(positions.length), ground = new Float32Array(positions.length / 3);
          for (let i = 0; i < positions.length / 3; i++) {
            const x = positions[i * 3], y = positions[i * 3 + 1], z = positions[i * 3 + 2];
            const slope = 1 - Math.abs(normals.getY(i));
            const crag = smooth(.28, .7, slope), altitude = smooth(500, 1050, y);
            ground[i] = (1 - crag) * (1 - altitude);
            color.copy(grass).lerp(granite, Math.max(crag, altitude)).lerp(darkGranite, (noise(x * .012, z * .012) * .5 + .5) * .27);
            color.lerp(snow, smooth(1480, 1900, y + noise(x * .017, z * .017) * 150) * (1 - crag * .6));
            colors.set([color.r, color.g, color.b], i * 3);
          }
          geometry.setAttribute('color', new T.BufferAttribute(colors, 3)); geometry.setAttribute('groundBlend', new T.BufferAttribute(ground, 1)); geometry.computeBoundingSphere(); resources.add(geometry);
          const mountain = new T.Mesh(geometry, rockMaterial); mountain.castShadow = true; mountain.receiveShadow = true;
          (side < 0 ? left : right).add(mountain);

        }

        // A continuous ground strip keeps the camera at a walker's height.
        const pathZ: number[] = [];
        for (let z = 1050; z >= -1600; z -= mobile ? 3 : 2) pathZ.push(z);
        for (let z = -1620; z >= -7800; z -= 25) pathZ.push(z);
        const pathSegments = pathZ.length - 1, pathPositions = [], pathUV = [], pathColors = [], pathIndices = [], pathEdges = [];
        for (let i = 0; i <= pathSegments; i++) {
          const z = pathZ[i];
          for (let j = 0; j < 9; j++) {
            const side = j / 8 * 2 - 1, x = trailX(z) + side * trailHalfWidth(z);
            pathPositions.push(x, terrainHeight(x, z) + .055, z); pathUV.push(x / 2.8, z / 2.8); pathEdges.push(side);
            const tone = .94 + noise(x * .27, z * .27) * .08;
            pathColors.push(tone, tone, tone * .96);
            if (i < pathSegments && j < 8) { const a = i * 9 + j; pathIndices.push(a, a + 1, a + 9, a + 1, a + 10, a + 9); }
          }
        }
        const pathGeometry = new T.BufferGeometry(); pathGeometry.setAttribute('position', new T.Float32BufferAttribute(pathPositions, 3)); pathGeometry.setAttribute('uv', new T.Float32BufferAttribute(pathUV, 2)); pathGeometry.setAttribute('color', new T.Float32BufferAttribute(pathColors, 3)); pathGeometry.setAttribute('pathEdge', new T.Float32BufferAttribute(pathEdges, 1)); pathGeometry.setIndex(pathIndices); pathGeometry.computeVertexNormals(); resources.add(pathGeometry);
        trail = new T.Mesh(pathGeometry, trailMaterial); trail.receiveShadow = true; scene.add(trail);

        const forest = addTrailForest(T, { mobile, left, right, terrainHeight, trailX, resources, isDisposed: () => disposed, onReady: invalidate });
        // Let input and the loading state paint before constructing the remaining details.
        await new Promise<void>(resolve => setTimeout(resolve, 0));
        if (disposed || fallback) return;
        const dummy = new T.Object3D();

        const boulderGeometry = new T.IcosahedronGeometry(1, 2); resources.add(boulderGeometry);
        const boulderPositions = boulderGeometry.getAttribute('position');
        const boulderNormals = boulderGeometry.getAttribute('normal');
        for (let i = 0; i < boulderPositions.count; i++) {
          const x = boulderPositions.getX(i), y = boulderPositions.getY(i), z = boulderPositions.getZ(i);
          const r = .88 + noise(x * 2.8 + z * .7, y * 2.8 - z * 1.6) * .15;
          boulderPositions.setXYZ(i, x * r, y * r, z * r);
          const length = Math.hypot(x, y, z); boulderNormals.setXYZ(i, x / length, y / length, z / length);
        }
        for (const side of [-1, 1]) {
          const count = mobile ? 82 : 145, boulders = new T.InstancedMesh(boulderGeometry, boulderMaterial, count);
          for (let i = 0; i < count; i++) {
            const z = 790 - hash(i, side + 204) * 2350, x = trailX(z) + side * (5.3 + Math.pow(hash(i, side + 210), 1.8) * 125);
            const clearing = Math.exp(-(((z - 585) / 125) ** 2));
            const size = (.4 + Math.pow(hash(i, side + 303), 1.6) * 3.4) * (1 - clearing * .45);
            dummy.position.set(x, terrainHeight(x, z) + size * .18, z); dummy.rotation.set(hash(i, 300) * 2, hash(i, 310) * 5, hash(i, 320) * 2); dummy.scale.set(size, size * (.48 + hash(i, 340) * .55), size * (.7 + hash(i, 350) * .6)); dummy.updateMatrix(); boulders.setMatrixAt(i, dummy.matrix);
            color.setRGB(.8 + hash(i, 600) * .23, .8 + hash(i, 601) * .22, .74 + hash(i, 602) * .21); boulders.setColorAt(i, color);
          }
          boulders.castShadow = true; boulders.receiveShadow = true; (side < 0 ? left : right).add(boulders);
        }
        const plants = addTrailDetails(T, scene, { mobile, terrainHeight, trailX, resources });
        const landscape = addTrailLandscape(T, scene, { mobile, resources, stoneMaterial: boulderMaterial, isDisposed: () => disposed });
        const understory = addTrailUnderstory(T, scene, { mobile, terrainHeight, trailX, resources });
        const wildlife = addTrailWildlife(T, scene, { mobile, terrainHeight, trailX, resources });
        focusWildlife = wildlife.focusPoint;
        details = { animate: seconds => { plants.animate(seconds); forest.animate(seconds, camera?.position); landscape.animate(seconds); understory.animate(seconds, camera?.position); wildlife.animate(seconds, camera?.position); } };
        readyScene = true;
        clearTimeout(loadingDeadline);
        measure();
        progress = target;
        queue();
        setReady(true);
      } catch { fail(); }
    }

    const sizes = new ResizeObserver(measure); sizes.observe(underlay); sizes.observe(visual);
    readMotion(); measure(); progress = target;
    addEventListener('scroll', readScroll, { passive: true });
    addEventListener('resize', measure, { passive: true });
    stage.addEventListener('pointermove', look, { passive: true });
    stage.addEventListener('pointerdown', beginLook, { passive: true });
    addEventListener('pointerup', finishLook); addEventListener('pointercancel', finishLook);
    addEventListener('summit:enter', enterEvent); addEventListener('hashchange', hashChanged);
    document.addEventListener('pointerleave', resetLook); document.addEventListener('visibilitychange', resume);
    motion.addEventListener('change', readMotion); canvas.addEventListener('webglcontextlost', contextLost);
    // The club remains reachable when a graphics import or driver stalls.
    const loadingDeadline = setTimeout(() => { if (!readyScene) fail(); }, 12000);
    void buildScene();
    if (location.hash === '#basecamp' || location.hash === '#home') initialHashFrame = requestAnimationFrame(hashChanged);
    return () => {
      disposed = true; clearTimeout(loadingDeadline); cancelAnimationFrame(frame); cancelAnimationFrame(resizeFrame); cancelAnimationFrame(focusFrame); cancelAnimationFrame(initialHashFrame); sizes.disconnect();
      removeEventListener('scroll', readScroll); removeEventListener('resize', measure); stage.removeEventListener('pointermove', look);
      stage.removeEventListener('pointerdown', beginLook);
      removeEventListener('pointerup', finishLook); removeEventListener('pointercancel', finishLook);
      removeEventListener('summit:enter', enterEvent); removeEventListener('hashchange', hashChanged);
      document.removeEventListener('pointerleave', resetLook); document.removeEventListener('visibilitychange', resume);
      motion.removeEventListener('change', readMotion); canvas.removeEventListener('webglcontextlost', contextLost);
      resources.forEach(resource => resource.dispose()); renderer?.dispose();
    };
  }, []);

  const enter = (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); enterRef.current(); };
  const summitActionsVisible = phase === 'summit';
  return <section id="home" ref={shellRef} className={`sx-experience${simple ? ' sx-simple' : ''}${failed ? ' sx-fallback' : ''}`} aria-label="The ascent to SUMMIT">
    <div className="sx-backdrop" ref={visualRef} aria-hidden="true"><div className="sx-world"><canvas ref={canvasRef} />{failed && <div className="sx-fallback-image" />}<div className="sx-world-shade" /></div></div>
    <div className="sx-journey">
    <div className="sx-stage" ref={stageRef} data-phase={phase} data-ready={ready} data-walking={walking} data-close-view={closeView}>
      <div className="sx-cinematic" aria-hidden={phase === 'revealed'} inert={phase === 'revealed'}>
        {!ready && <span className="sx-loading">FINDING THE TRAIL<span /></span>}
        <div className="sx-topbar" inert={!walking || simple}><span>CATHEDRAL CATHOLIC<span>OUTDOOR ADVENTURE CLUB</span></span><a href="#basecamp" onClick={enter}>Skip to the club <ArrowDown size={14} /></a></div>
        <div className="sx-opening"><span className="sx-eyebrow">GOOD PEOPLE. OPEN AIR. A LITTLE FURTHER.</span><p>Meet SUMMIT<br />at the top.</p><span className="sx-opening-copy">A club for every Cathedral Catholic student.<br />Your scroll sets the pace.</span></div>
        <div className="sx-trail-stories" aria-live="polite" aria-atomic="true">{trailStops.map((item, index) => <article key={item.name} className="sx-trail-story" data-active={stop === index} aria-hidden={stop !== index}><span className="sx-eyebrow">0{index + 1} / {item.name.toUpperCase()}</span><h2>{item.title}</h2><p>{item.copy}</p></article>)}</div>
        <nav className="sx-trail-stops" aria-label="Stops along the SUMMIT trail" inert={!walking || simple}><span className="sx-trail-progress" aria-hidden="true"><i /></span>{trailStops.map((item, index) => <button key={item.name} onClick={() => stopRef.current(item.at)} aria-current={stop === index ? 'step' : undefined}><span>0{index + 1}</span>{item.name}</button>)}</nav>
        <div className="sx-look-controls" role="group" aria-label="Look around the scenery" inert={!walking || simple}><span>{closeView ? 'A LITTLE CLOSER · SCROLL TO CONTINUE' : 'LOOK AROUND'}</span><div><button aria-label="Look left" onClick={() => turnRef.current(-.45)}><ChevronLeft size={18} /></button><button aria-label="Face the trail" onClick={() => turnRef.current(null)}><Compass size={19} /></button><button aria-label="Look right" onClick={() => turnRef.current(.45)}><ChevronRight size={18} /></button><button aria-label={closeView ? 'Return to the wide view' : 'Look closer at the wildlife'} title="Look closer" aria-pressed={closeView} onClick={() => zoomRef.current()}><Binoculars size={18} /></button></div><small><span className="sx-mouse-hint">Drag left or right to look</span><span className="sx-touch-hint">Swipe sideways to look</span></small></div>
        <div className="sx-titlecard"><span className="sx-eyebrow">THE VIEW IS JUST THE BEGINNING.</span><h1>SUMMIT</h1><span className="sx-motto">EXPLORE. SERVE. LEAD.</span><p>Cathedral Catholic’s outdoor adventure,<br />service &amp; leadership club.</p><div className="sx-arrival-actions" aria-hidden={!summitActionsVisible}><a className="sx-enter" href="#basecamp" onClick={enter} tabIndex={summitActionsVisible ? 0 : -1}>Enter SUMMIT <ArrowDown size={17} /></a><button onClick={onJoin} tabIndex={summitActionsVisible ? 0 : -1}>Join SUMMIT <Plus size={16} /></button></div></div>
        <div className="sx-scroll-cue"><span className="sx-scroll-stem" aria-hidden="true" /><span>{phase === 'summit' ? 'SCROLL INTO BASECAMP' : 'SCROLL TO WALK'}<small>{phase === 'summit' ? 'YOUR CREW IS JUST AHEAD.' : 'STOP TO LOOK. SCROLL BACK TO RETURN.'}</small></span></div>

      </div>
      <p className="sx-screen-reader">A scroll-controlled journey through an illustrative three-dimensional alpine landscape. SUMMIT is Cathedral Catholic High School’s student-led outdoor adventure, service, and leadership club.</p>
    </div>
    </div>
    <div className="sx-underlay" ref={underlayRef} aria-hidden={!underlayVisible} inert={!underlayVisible}>{children}</div>
  </section>;
}
