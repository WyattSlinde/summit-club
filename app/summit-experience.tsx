'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, Mountain, RotateCcw } from 'lucide-react';
import { ScrollSequence } from './scroll-sequence';
import { JOURNEY_VIEWPORTS, trailJourney, frameForProgress, reflowScroll } from './trail-journey';
import media from './journey-media.json';
import './summit-experience.css';

// The visible granite edge in the summit still, in the source image's coordinates.
const ridge = [[0,900],[55,801],[112,751],[160,716],[200,690],[270,677],[350,693],[430,689],[500,706],[554,730],[605,774],[630,749],[660,719],[704,685],[740,642],[785,610],[831,604],[904,602],[989,617],[1053,646],[1115,696],[1133,678],[1150,661],[1190,655],[1234,669],[1295,689],[1348,720],[1368,750],[1400,765],[1431,784],[1480,792],[1525,790],[1595,803],[1675,815],[1767,829],[1813,868],[1863,910],[1920,916]];
const stops = [
  { name: 'The trail', at: .10, start: .12, end: .25, title: 'Explore.', copy: 'Get outside with your Cathedral Catholic crew.' },
  { name: 'The climb', at: .30, start: .28, end: .40, title: 'Serve. Lead.', copy: 'Give back. Try something new. Help make it happen.' },
];
type Props = { onJoin: () => void; children: ReactNode; onReveal?: (visible: boolean) => void };
export default function SummitExperience({ onJoin, children, onReveal }: Props) {
  const shellRef = useRef<HTMLElement>(null), visualRef = useRef<HTMLDivElement>(null), underlayRef = useRef<HTMLDivElement>(null), canvasRef = useRef<HTMLCanvasElement>(null);
  const enterRef = useRef<() => void>(() => undefined), seekRef = useRef<(p: number) => void>(() => undefined), revealRef = useRef(onReveal);
  const [ready, setReady] = useState(false), [simple, setSimple] = useState(false), [failed, setFailed] = useState(false);
  const [phase, setPhase] = useState('opening'), [stop, setStop] = useState(-1), [underlayVisible, setUnderlayVisible] = useState(false);
  useEffect(() => { revealRef.current = onReveal; }, [onReveal]);
  useEffect(() => {
    const shell = shellRef.current, visual = visualRef.current, underlay = underlayRef.current, canvas = canvasRef.current;
    if (!shell || !visual || !underlay || !canvas) return;
    const context = canvas.getContext('2d', { alpha: false });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    let disposed = false, fallback = !context, frame = 0, focusFrame = 0;
    let start = 0, runway = 1, progress = 0, focusDestination: string | null = null;
    let measured = false, measuredSimple = false, measuredHeight = 0;
    let sequence: ScrollSequence | undefined, currentImage: ImageBitmap | undefined;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    let previousPhase = '', previousStop = -2, previousAccessible: boolean | undefined, lastDrawn = -1;
    const isSimple = () => motion.matches || !!connection?.saveData || fallback;
    function draw(image: ImageBitmap, index: number) {
      if (disposed || !context || !canvas) return;
      currentImage = image;
      const w = canvas.width, h = canvas.height, scale = Math.max(w / image.width, h / image.height);
      const width = image.width * scale, height = image.height * scale;
      context.drawImage(image, (w - width) / 2, (h - height) / 2, width, height);
      if (lastDrawn < 0) { setReady(true); clearTimeout(deadline); }
      lastDrawn = index;
      shell!.dataset.frame = String(index);
    }
    function fail() {
      if (disposed) return;
      clearTimeout(deadline);
      fallback = true; setFailed(true); setReady(true);
      sequence?.dispose(); sequence = undefined; currentImage = undefined;
      measure();
    }
    function update() {
      frame = 0;
      if (disposed || !shell || !underlay) return;
      progress = Math.max(0, Math.min(1, (scrollY - start) / Math.max(1, runway)));
      const state = trailJourney(progress, isSimple());
      shell.style.setProperty('--sx-intro', String(state.intro));
      shell.style.setProperty('--sx-title', String(state.title));
      shell.style.setProperty('--sx-ui', String(state.controls));
      shell.style.setProperty('--sx-camp', String(state.camp));
      shell.style.setProperty('--sx-shadow', String(state.shade));
      shell.style.setProperty('--sx-title-y', `${state.titleY}vh`);
      shell.style.setProperty('--sx-foreground', String(state.foreground));
      shell.style.setProperty('--sx-cover', `${state.cover}%`);
      shell.style.setProperty('--sx-scene-scale', String(1 + state.approach * .08));
      shell.style.setProperty('--sx-scene-y', `${-state.approach * 9}vh`);
      const remaining = Math.max(0, start + runway - scrollY);
      shell.style.setProperty('--sx-page-y', isSimple() ? '0px' : `${-remaining + (1 - state.approach) * visual!.clientHeight * .65}px`);
      shell.style.setProperty('--sx-page-angle', `${isSimple() ? 0 : (1 - state.approach) * 24}deg`);
      shell.style.setProperty('--sx-page-scale', String(isSimple() ? 1 : .74 + state.approach * .26));
      shell.style.setProperty('--sx-distance', `${state.walk * 100}%`);
      shell.dataset.journeyProgress = progress.toFixed(4);
      const nextStop = isSimple() ? -1 : stops.findIndex(item => progress >= item.start && progress < item.end);
      if (nextStop !== previousStop) { previousStop = nextStop; setStop(nextStop); }
      if (state.phase !== previousPhase) { previousPhase = state.phase; setPhase(state.phase); }
      if (state.accessible !== previousAccessible) { previousAccessible = state.accessible; setUnderlayVisible(state.accessible); revealRef.current?.(state.navigation); }
      if (!isSimple()) sequence?.seek(frameForProgress(progress, media.frameCount, 'summitFrame' in media ? Number(media.summitFrame) : undefined));
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
      const reduced = isSimple(), height = visual.clientHeight;
      const newRunway = reduced ? 0 : height * JOURNEY_VIEWPORTS;
      const restore = measured && (reduced !== measuredSimple || height !== measuredHeight)
        ? reflowScroll(scrollY, start, runway, newRunway, measuredHeight, height, measuredSimple, reduced) : null;
      setSimple(reduced); shell.classList.toggle('sx-simple', reduced);
      runway = newRunway;
      shell.style.setProperty('--sx-runway', `${runway}px`);
      start = shell.getBoundingClientRect().top + scrollY;
      measured = true; measuredSimple = reduced; measuredHeight = height;
      if (restore !== null) scrollTo({ top: restore, behavior: 'instant' });
      // Match object-fit: cover so the title rises behind the same rocks on phones and desktops.
      const crop = Math.max(visual.clientWidth / 1920, height / 1080);
      const ox = (visual.clientWidth - 1920 * crop) / 2, oy = (height - 1080 * crop) / 2;
      shell.style.setProperty('--sx-ridge', `polygon(${ridge.map(([x, y]) => `${x * crop + ox}px ${y * crop + oy}px`).join(',')},100% 100%,0 100%)`);
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(visual.clientWidth * dpr); canvas.height = Math.round(visual.clientHeight * dpr);
      if (currentImage && !reduced) draw(currentImage, lastDrawn);
      queue();
    }
    function goToSection(id: string, immediate = false) {
      const destination = document.getElementById(id);
      if (!destination || !underlay!.contains(destination)) return;
      measure(); focusDestination = id;
      // offsetTop is unaffected by the camera's CSS perspective transform.
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
      sequence?.dispose(); sequence = undefined; currentImage = undefined;
      if (isSimple()) { setReady(true); clearTimeout(deadline); measure(); return; }
      deadline = setTimeout(() => { if (lastDrawn < 0 && !isSimple()) fail(); }, 18000);
      const mobile = innerWidth < 800;
      sequence = new ScrollSequence({ count: media.frameCount,
        url: index => `${media.path}/${mobile ? 'mobile' : 'desktop'}/${String(index).padStart(4, '0')}.webp?v=${media.version}`,
        maxDecoded: mobile ? 24 : 32, onFrame: draw, onError: fail });
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
    <div className="sx-journey"><div className="sx-stage" data-phase={phase} data-ready={ready}>
      <div className="sx-cinematic" aria-hidden={hidden} inert={hidden}>
        <div className="sx-topbar" inert={atSummit || descending || simple}><a href="#basecamp" onClick={enter} className="sx-school"><Mountain size={28} strokeWidth={1.3} /><span>CATHEDRAL CATHOLIC<small>THE OUTDOOR CLUB</small></span></a><a className="sx-skip" href="#basecamp" onClick={enter}>Club &amp; signup <ArrowUpRight size={15} /></a></div>
        <div className="sx-opening" aria-hidden={phase !== 'opening'}><span className="sx-eyebrow">CATHEDRAL CATHOLIC’S OUTDOOR CLUB</span><p>It starts<br /><em>with a climb.</em></p><span className="sx-opening-copy">Scroll up the mountain.<br />There’s something waiting at the top.</span></div>
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
