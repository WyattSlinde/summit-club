'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, Mountain, RotateCcw } from 'lucide-react';
import { ScrollSequence } from './scroll-sequence';
import { JOURNEY_VIEWPORTS, trailJourney, framePositionForProgress, reflowScroll, canvasResolution, frameFocalX } from './trail-journey';
import media from './journey-media.json';
import './summit-experience.css';

// The visible granite edge in the summit still, in the source image's coordinates.
const ridge = [[0,852],[45,797],[90,751],[130,719],[170,698],[210,685],[253,677],[282,680],[327,689],[386,689],[444,694],[500,709],[551,733],[602,776],[616,786],[638,749],[667,709],[706,675],[744,637],[787,610],[834,601],[900,601],[962,610],[1020,628],[1080,659],[1131,695],[1147,675],[1177,656],[1212,650],[1252,667],[1298,688],[1344,715],[1400,756],[1450,797],[1500,799],[1550,792],[1620,806],[1690,814],[1762,830],[1815,855],[1870,890],[1920,902]];
const stops = [
  { name: 'Explore', at: .14, start: .12, end: .235, title: 'A little further outside.', copy: 'Trails, coastlines, and new experiences with your Cathedral Catholic crew. No outdoor experience needed.' },
  { name: 'Serve', at: .29, start: .265, end: .375, title: 'Leave it better.', copy: 'Beach cleanups, habitat restoration, and service projects. Getting outside is better when we give something back.' },
  { name: 'Lead', at: .43, start: .405, end: .50, title: 'Make it happen.', copy: 'Pitch an idea. Choose the next adventure. Help plan it with your friends. This is your club to build.' },
];
type Props = { onJoin: () => void; children: ReactNode; onReveal?: (visible: boolean) => void };
export default function SummitExperience({ onJoin, children, onReveal }: Props) {
  const shellRef = useRef<HTMLElement>(null), visualRef = useRef<HTMLDivElement>(null), stageRef = useRef<HTMLDivElement>(null), underlayRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const enterRef = useRef<() => void>(() => undefined), seekRef = useRef<(p: number) => void>(() => undefined), revealRef = useRef(onReveal);
  const [ready, setReady] = useState(false), [simple, setSimple] = useState(false), [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState('opening'), [stop, setStop] = useState(-1), [underlayVisible, setUnderlayVisible] = useState(false);
  useEffect(() => { revealRef.current = onReveal; }, [onReveal]);
  useEffect(() => {
    const shell = shellRef.current, visual = visualRef.current, stage = stageRef.current, underlay = underlayRef.current, canvas = canvasRef.current;
    if (!shell || !visual || !stage || !underlay || !canvas) return;
    const context = canvas.getContext('2d', { alpha: false, desynchronized: true });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let disposed = false, fallback = !context, frame = 0, focusFrame = 0;
    let start = 0, runway = 1, progress = 0, focusDestination: string | null = null;
    let measured = false, measuredSimple = false, measuredHeight = 0, measuredWidth = 0;
    const styleCache = new WeakMap<HTMLElement, Map<string, string>>();
    function setStyle(element: HTMLElement, name: string, value: number | string) {
      const text = typeof value === 'number' ? String(Math.round(value * 10000) / 10000) : value;
      let cache = styleCache.get(element);
      if (!cache) { cache = new Map(); styleCache.set(element, cache); }
      if (cache.get(name) !== text) { element.style.setProperty(name, text); cache.set(name, text); }
    }
    let sequence: ScrollSequence | undefined, currentImage: ImageBitmap | undefined, currentNext: ImageBitmap | undefined, currentMix = 0;
    let sequenceMobile: boolean | undefined;
    const isPortraitViewport = () => visual!.clientWidth / Math.max(1, visual!.clientHeight) <= 9 / 16;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let previousPhase = '', previousStop = -2, previousAccessible: boolean | undefined, previousEnded: boolean | undefined, lastDrawn = -1;
    const isSimple = () => motion.matches || !!connection?.saveData || fallback;
    function draw(image: ImageBitmap, index: number, nextImage?: ImageBitmap, mix = 0) {
      if (disposed || !context || !canvas) return;
      currentImage = image; currentNext = nextImage; currentMix = mix;
      const w = canvas.width, h = canvas.height;
      const paint = (bitmap: ImageBitmap, pose: number, opacity: number) => {
        const scale = Math.max(w / bitmap.width, h / bitmap.height);
        const width = bitmap.width * scale, height = bitmap.height * scale;
        context.globalAlpha = opacity;
        context.imageSmoothingQuality = bitmap.width >= (sequenceMobile ? media.mobileWidth : media.width) ? 'high' : 'medium';
        context.drawImage(bitmap, (w - width) * frameFocalX(pose, media.fps), (h - height) / 2, width, height);
      };
      // Fractional scroll positions blend adjacent poses, so small wheel/trackpad
      // movements do not round to the same still. No clock advances this blend.
      paint(image, index, 1);
      if (nextImage && mix > 0) paint(nextImage, index + 1, mix);
      context.globalAlpha = 1;
      if (lastDrawn < 0) { setReady(true); clearTimeout(deadline); }
      lastDrawn = index;
      shell!.dataset.frame = (index + mix).toFixed(3);
    }
    function fail() {
      if (disposed) return;
      clearTimeout(deadline);
      fallback = true; setFailed(true); setReady(true);
      sequence?.dispose(); sequence = undefined; currentImage = undefined; currentNext = undefined;
      measure();
    }
    function update() {
      frame = 0;
      if (disposed || !shell || !underlay) return;
      const currentScroll = scrollY;
      progress = Math.max(0, Math.min(1, (currentScroll - start) / Math.max(1, runway)));
      const state = trailJourney(progress, isSimple());
      // Keep changing values on their visual layer, rather than invalidating the entire club tree.
      setStyle(stage!, '--sx-intro', state.intro);
      setStyle(stage!, '--sx-title', state.title);
      setStyle(stage!, '--sx-ui', state.controls);
      setStyle(stage!, '--sx-title-y', `${state.titleY.toFixed(3)}vh`);
      setStyle(stage!, '--sx-foreground', state.foreground);
      setStyle(stage!, '--sx-distance', `${(state.walk * 100).toFixed(3)}%`);
      setStyle(visual!, '--sx-cover', `${state.cover.toFixed(3)}%`);
      setStyle(visual!, '--sx-scene-scale', 1 + state.approach * .045);
      setStyle(visual!, '--sx-scene-y', `${(-state.approach * 5).toFixed(3)}vh`);
      const remaining = Math.max(0, start + runway - currentScroll);
      const ended = progress >= 1 || isSimple();
      setStyle(underlay, 'opacity', state.camp);
      // No inherited animation variables or 3D texture for the long club page.
      setStyle(underlay, 'transform', ended || state.camp === 0 ? 'none' : `translateY(${(-remaining + (1 - state.approach) * measuredHeight * .12).toFixed(2)}px)`);
      if (ended !== previousEnded) { previousEnded = ended; shell.dataset.journeyEnded = String(ended); }
      shell.dataset.journeyProgress = progress.toFixed(4);
      const nextStop = isSimple() ? -1 : stops.findIndex(item => progress >= item.start && progress < item.end);
      const story = stops[nextStop];
      const edge = story ? Math.max(0, Math.min(1, (progress - story.start) / .016, (story.end - progress) / .016)) : 0;
      const storyOpacity = edge * edge * (3 - 2 * edge);
      setStyle(stage!, '--sx-story-opacity', storyOpacity);
      setStyle(stage!, '--sx-story-y', `${((1 - storyOpacity) * 12).toFixed(2)}px`);
      if (nextStop !== previousStop) { previousStop = nextStop; setStop(nextStop); }
      if (state.phase !== previousPhase) { previousPhase = state.phase; setPhase(state.phase); }
      if (state.accessible !== previousAccessible) { previousAccessible = state.accessible; setUnderlayVisible(state.accessible); revealRef.current?.(state.navigation); }
      if (!isSimple()) sequence?.seek(framePositionForProgress(progress, media.frameCount, 'summitFrame' in media ? Number(media.summitFrame) : undefined));
      if (state.accessible && focusDestination) {
        const destinationId = focusDestination; focusDestination = null;
        focusFrame = requestAnimationFrame(() => {
          const target = document.getElementById(destinationId);
          if (target && !underlay.inert) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
        });
      }
    }
    function queue() { if (!frame && !disposed) frame = requestAnimationFrame(update); }
    function measure() {
      if (disposed || !shell || !visual || !canvas) return;
      const reduced = isSimple(), height = visual.clientHeight, width = visual.clientWidth;
      if (measured && reduced === measuredSimple && height === measuredHeight && width === measuredWidth) { queue(); return; }
      const newRunway = reduced ? 0 : height * JOURNEY_VIEWPORTS;
      const restore = measured && (reduced !== measuredSimple || height !== measuredHeight)
        ? reflowScroll(scrollY, start, runway, newRunway, measuredHeight, height, measuredSimple, reduced) : null;
      setSimple(reduced); shell.classList.toggle('sx-simple', reduced);
      runway = newRunway;
      shell.style.setProperty('--sx-runway', `${runway}px`);
      start = shell.getBoundingClientRect().top + scrollY;
      measured = true; measuredSimple = reduced; measuredHeight = height; measuredWidth = width;
      if (restore !== null) scrollTo({ top: restore, behavior: 'instant' });
      // Match object-fit: cover so the title rises behind the same rocks on phones and desktops.
      const crop = Math.max(width / 1920, height / 1080);
      const ox = (width - 1920 * crop) / 2, oy = (height - 1080 * crop) / 2;
      setStyle(stage!, '--sx-ridge', `polygon(${ridge.map(([x, y]) => `${x * crop + ox}px ${y * crop + oy}px`).join(',')},100% 100%,0 100%)`);
      const resolution = canvasResolution(width, height, devicePixelRatio);
      canvas.width = resolution.width; canvas.height = resolution.height;
      if (context) { context.imageSmoothingEnabled = true; context.imageSmoothingQuality = 'high'; }
      if (sequence && !reduced && sequenceMobile !== isPortraitViewport()) { startSequence(); return; }
      if (currentImage && !reduced) draw(currentImage, lastDrawn, currentNext, currentMix);
      queue();
    }
    function goToSection(id: string, immediate = false) {
      const destination = document.getElementById(id);
      if (!destination || !underlay!.contains(destination)) return;
      measure(); focusDestination = id;
      // offsetTop stays stable while the arrival layer moves into view.
      let offset = 0, node: HTMLElement | null = destination;
      while (node && node !== underlay) { offset += node.offsetTop; node = node.offsetParent as HTMLElement | null; }
      const clubStart = isSimple() ? start + underlay!.offsetTop : start + runway;
      const headerHeight = document.querySelector<HTMLElement>('.masthead')?.offsetHeight || 76;
      if (location.hash !== `#${id}`) history.pushState(null, '', `#${id}`);
      scrollTo({ top: Math.max(clubStart, clubStart + offset - headerHeight), behavior: immediate || isSimple() ? 'instant' : 'smooth' }); queue();
    }
    enterRef.current = () => goToSection('basecamp');
    seekRef.current = p => {
      focusDestination = null;
      if (location.hash !== '#home') history.replaceState(null, '', '#home');
      measure(); scrollTo({ top: start + p * runway, behavior: isSimple() ? 'instant' : 'smooth' }); queue();
    };
    const enterEvent = () => goToSection('basecamp');
    const navigateEvent = (event: Event) => {
      const id = (event as CustomEvent<string>).detail;
      if (typeof id === 'string') goToSection(id);
    };
    const clubLink = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element)?.closest?.('a[href^="#"]');
      const id = link?.getAttribute('href')?.slice(1), target = id ? document.getElementById(id) : null;
      if (id && target && underlay!.contains(target)) { event.preventDefault(); goToSection(id); }
    };
    const hashChanged = () => {
      if (location.hash === '#home') { focusDestination = null; scrollTo({ top: start, behavior: 'instant' }); queue(); }
      else goToSection(location.hash.slice(1), true);
    };
    function startSequence() {
      clearTimeout(deadline); setReady(false); lastDrawn = -1;
      sequence?.dispose(); sequence = undefined; currentImage = undefined; currentNext = undefined;
      if (isSimple()) { setReady(true); clearTimeout(deadline); measure(); return; }
      deadline = setTimeout(() => { if (lastDrawn < 0 && !isSimple()) fail(); }, 18000);
      const mobile = isPortraitViewport(); sequenceMobile = mobile;
      sequence = new ScrollSequence({ count: media.frameCount,
        url: index => `${media.path}/${mobile ? 'mobile' : 'desktop'}/${String(index).padStart(4, '0')}.webp?v=${media.version}`,
        previewUrl: index => `${media.motionPath}/${mobile ? 'mobile' : 'desktop'}/${String(index).padStart(4, '0')}.webp?v=${media.version}`,
        maxDecoded: 2, maxPreviewDecoded: 32, onFrame: draw, onError: fail });
      measure();
    }
    const sizes = new ResizeObserver(measure); sizes.observe(visual); sizes.observe(underlay);
    addEventListener('scroll', queue, { passive: true }); addEventListener('resize', measure, { passive: true });
    addEventListener('summit:enter', enterEvent); addEventListener('summit:navigate', navigateEvent); document.addEventListener('click', clubLink); addEventListener('hashchange', hashChanged); motion.addEventListener('change', startSequence);
    startSequence(); const initial = requestAnimationFrame(hashChanged);
    return () => {
      disposed = true; clearTimeout(deadline); cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); cancelAnimationFrame(initial);
      sizes.disconnect(); sequence?.dispose();
      removeEventListener('scroll', queue); removeEventListener('resize', measure); removeEventListener('summit:enter', enterEvent); removeEventListener('summit:navigate', navigateEvent); document.removeEventListener('click', clubLink); removeEventListener('hashchange', hashChanged); motion.removeEventListener('change', startSequence);
    };
  }, []);
  const enter = (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); enterRef.current(); };
  const atSummit = phase === 'summit', descending = phase === 'descending', hidden = phase === 'revealed';
  return <section id="home" ref={shellRef} className={`sx-experience${simple ? ' sx-simple' : ''}${failed ? ' sx-fallback' : ''}`} aria-label="The hike to SUMMIT">
    <div className="sx-backdrop" ref={visualRef} aria-hidden="true"><div className="sx-world"><img className="sx-poster" src={`${media.path}/${simple ? 'overlook' : 'trailhead'}.webp`} alt="" fetchPriority="high" /><canvas ref={canvasRef} className={ready && !simple ? 'is-ready' : ''} /><div className="sx-world-shade" /></div></div>
    <div className="sx-journey"><div ref={stageRef} className="sx-stage" data-phase={phase} data-ready={ready}>
      <div className="sx-cinematic" aria-hidden={hidden} inert={hidden}>
        <div className="sx-topbar" inert={atSummit || descending || simple}><a href="#basecamp" onClick={enter} className="sx-school"><Mountain size={28} strokeWidth={1.3} /><span>CATHEDRAL CATHOLIC<small>THE OUTDOOR CLUB</small></span></a><a className="sx-skip" href="#basecamp" onClick={enter}>Club &amp; signup <ArrowUpRight size={15} /></a></div>
        <div className="sx-opening" aria-hidden={phase !== 'opening'}><span className="sx-eyebrow">CATHEDRAL CATHOLIC’S OUTDOOR CLUB</span><p>It starts<br /><em>with a climb.</em></p><span className="sx-opening-copy">Scroll to climb the mountain.<br />There’s something waiting at the top.</span></div>
        <div className="sx-trail-stories" aria-live="polite" aria-atomic="true">{stops.map((item, index) => <article key={item.name} className="sx-trail-story" data-active={stop === index} aria-hidden={stop !== index}><span className="sx-eyebrow">0{index + 1} — {item.name.toUpperCase()}</span><h2>{item.title}</h2><p>{item.copy}</p></article>)}</div>
        <nav className="sx-route" aria-label="Along the trail" inert={atSummit || descending || simple}><span className="sx-route-line"><i /></span>{stops.map((item, index) => <button key={item.name} onClick={() => seekRef.current(item.at)} aria-current={stop === index ? 'step' : undefined}><i />{item.name}</button>)}<button onClick={() => seekRef.current(.65)}><Mountain size={13} />The summit</button></nav>
        <div className="sx-titlecard" aria-hidden={!atSummit}>
          <div className="sx-title-rise"><span className="sx-eyebrow">CATHEDRAL CATHOLIC HIGH SCHOOL</span><h1>SUMMIT</h1><span className="sx-motto">EXPLORE. SERVE. LEAD.</span></div>
        </div>
        <div className="sx-peak-foreground" aria-hidden="true"><img src={`${media.path}/summit.webp`} alt="" /><div className="sx-world-shade" /></div>
        <div className="sx-summit-invitation" aria-hidden={!atSummit} inert={!atSummit}><p>Adventure. Service. Your people.</p><span>KEEP SCROLLING. COME OVER THE TOP. <ArrowDown size={16}/></span><button onClick={onJoin}>Join SUMMIT <ArrowUpRight size={15}/></button></div>
        <div className="sx-bottom"><div className="sx-scroll-cue"><ArrowDown size={19} strokeWidth={1.3} /><span>{descending ? 'JUST OVER THE RIDGE' : atSummit ? 'YOU MADE IT' : 'SCROLL TO CLIMB'}<small>{descending ? 'Scroll into your club.' : atSummit ? 'The view is only the beginning.' : 'You set the pace. Scroll back to return.'}</small></span></div><span className="sx-field-note">{!ready ? 'PREPARING THE TRAIL…' : atSummit ? 'THE SUMMIT' : descending ? 'BASECAMP, AHEAD' : 'KEEP CLIMBING.'}</span></div>
      </div>
    </div></div>
    <div className="sx-underlay" ref={underlayRef} aria-hidden={!underlayVisible} inert={!underlayVisible}>{children}<div className="sx-arrival-strip"><span><Mountain size={15} /> EXPLORE. SERVE. LEAD.</span><button onClick={() => seekRef.current(0)}><RotateCcw size={13} /> Back to the mountain</button></div></div>
    <p className="sx-screen-reader">A scroll-controlled climb to a mountain summit. SUMMIT rises at the peak; continued scrolling moves over the ridge and into the club. The forest, wildlife, and mountain scenery are generated with Higgsfield. Skip directly to the club using the Club and signup link.</p>
  </section>;
}
