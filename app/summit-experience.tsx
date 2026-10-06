'use client';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ArrowDown, ArrowUpRight, Mountain, RotateCcw } from 'lucide-react';
import { ScrollSequence } from './scroll-sequence';
import { JOURNEY_VIEWPORTS, trailJourney, frameForProgress } from './trail-journey';
import media from './journey-media.json';
import './summit-experience.css';

const stops = [
  { name: 'Explore', at: .22, start: .15, end: .32, title: 'A little further outside.', copy: 'New trails. Good people. No experience needed.' },
  { name: 'Serve', at: .44, start: .37, end: .53, title: 'Leave it better.', copy: 'Care for the places—and the people—around us.' },
  { name: 'Lead', at: .64, start: .58, end: .72, title: 'Find your own way.', copy: 'Bring an idea. Plan an adventure. Take the lead.' },
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
    let start = 0, runway = 1, progress = 0, focusClub = false;
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
      shell.style.setProperty('--sx-distance', `${state.walk * 100}%`);
      shell.dataset.journeyProgress = progress.toFixed(4);
      const nextStop = isSimple() ? -1 : stops.findIndex(item => progress >= item.start && progress < item.end);
      if (nextStop !== previousStop) { previousStop = nextStop; setStop(nextStop); }
      if (state.phase !== previousPhase) { previousPhase = state.phase; setPhase(state.phase); }
      if (state.accessible !== previousAccessible) { previousAccessible = state.accessible; setUnderlayVisible(state.accessible); revealRef.current?.(state.navigation); }
      if (!isSimple()) sequence?.seek(frameForProgress(progress, media.frameCount));
      if (state.accessible && focusClub) {
        focusClub = false;
        focusFrame = requestAnimationFrame(() => {
          const target = underlay.querySelector<HTMLElement>('#basecamp');
          if (target && !underlay.inert) { target.tabIndex = -1; target.focus({ preventScroll: true }); }
        });
      }
    }
    function queue() { if (!frame && !disposed) frame = requestAnimationFrame(update); }
    function measure() {
      if (disposed || !shell || !visual || !canvas) return;
      const reduced = isSimple(); setSimple(reduced); shell.classList.toggle('sx-simple', reduced);
      runway = reduced ? 0 : visual.clientHeight * JOURNEY_VIEWPORTS;
      shell.style.setProperty('--sx-runway', `${runway}px`);
      start = shell.getBoundingClientRect().top + scrollY;
      const dpr = Math.min(devicePixelRatio || 1, 1.5);
      canvas.width = Math.round(visual.clientWidth * dpr); canvas.height = Math.round(visual.clientHeight * dpr);
      if (currentImage && !reduced) draw(currentImage, lastDrawn);
      queue();
    }
    function goToClub(immediate = false) {
      measure(); focusClub = true;
      if (location.hash !== '#basecamp') history.pushState(null, '', '#basecamp');
      scrollTo({ top: underlay!.getBoundingClientRect().top + scrollY, behavior: immediate || isSimple() ? 'instant' : 'smooth' }); queue();
    }
    enterRef.current = () => goToClub();
    seekRef.current = p => {
      if (location.hash !== '#home') history.replaceState(null, '', '#home');
      measure(); scrollTo({ top: start + p * runway, behavior: isSimple() ? 'instant' : 'smooth' }); queue();
    };
    const enterEvent = () => goToClub();
    const hashChanged = () => {
      if (location.hash === '#basecamp') goToClub(true);
      if (location.hash === '#home') { focusClub = false; scrollTo({ top: start, behavior: 'instant' }); queue(); }
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
    addEventListener('summit:enter', enterEvent); addEventListener('hashchange', hashChanged); motion.addEventListener('change', startSequence);
    startSequence(); const initial = requestAnimationFrame(hashChanged);
    return () => {
      disposed = true; clearTimeout(deadline); cancelAnimationFrame(frame); cancelAnimationFrame(focusFrame); cancelAnimationFrame(initial);
      sizes.disconnect(); sequence?.dispose();
      removeEventListener('scroll', queue); removeEventListener('resize', measure); removeEventListener('summit:enter', enterEvent); removeEventListener('hashchange', hashChanged); motion.removeEventListener('change', startSequence);
    };
  }, []);
  const enter = (event: React.MouseEvent<HTMLAnchorElement>) => { event.preventDefault(); enterRef.current(); };
  const atSummit = phase === 'summit', hidden = phase === 'revealed';
  return <section id="home" ref={shellRef} className={`sx-experience${simple ? ' sx-simple' : ''}${failed ? ' sx-fallback' : ''}`} aria-label="The hike to SUMMIT">
    <div className="sx-backdrop" ref={visualRef} aria-hidden="true"><div className="sx-world"><img className="sx-poster" src={`${media.path}/${simple ? 'overlook' : 'trailhead'}.webp`} alt="" fetchPriority="high" /><canvas ref={canvasRef} className={ready && !simple ? 'is-ready' : ''} /><div className="sx-world-shade" /></div></div>
    <div className="sx-journey"><div className="sx-stage" data-phase={phase} data-ready={ready}>
      <div className="sx-cinematic" aria-hidden={hidden} inert={hidden}>
        <div className="sx-topbar" inert={atSummit || simple}><a href="#basecamp" onClick={enter} className="sx-school"><Mountain size={28} strokeWidth={1.3} /><span>CATHEDRAL CATHOLIC<small>THE OUTDOOR CLUB</small></span></a><a className="sx-skip" href="#basecamp" onClick={enter}>Club &amp; signup <ArrowUpRight size={15} /></a></div>
        <div className="sx-opening" aria-hidden={phase !== 'opening'}><span className="sx-eyebrow">YOUR NEXT CHAPTER STARTS OUTSIDE.</span><p>Take the<br /><em>scenic route.</em></p><span className="sx-opening-copy">A little adventure. A bigger purpose.<br />A club for every Cathedral Catholic student.</span></div>
        <div className="sx-trail-stories" aria-live="polite" aria-atomic="true">{stops.map((item, index) => <article key={item.name} className="sx-trail-story" data-active={stop === index} aria-hidden={stop !== index}><span className="sx-eyebrow">0{index + 1} — {item.name.toUpperCase()}</span><h2>{item.title}</h2><p>{item.copy}</p></article>)}</div>
        <nav className="sx-route" aria-label="Along the trail" inert={atSummit || simple}><span className="sx-route-line"><i /></span>{stops.map((item, index) => <button key={item.name} onClick={() => seekRef.current(item.at)} aria-current={stop === index ? 'step' : undefined}><i />{item.name}</button>)}<button onClick={() => seekRef.current(.86)}><Mountain size={13} />The summit</button></nav>
        <div className="sx-titlecard" aria-hidden={!atSummit}><span className="sx-eyebrow">YOU’VE FOUND YOUR PEOPLE.</span><h1>SUMMIT</h1><span className="sx-motto">EXPLORE. SERVE. LEAD.</span><p>Cathedral Catholic’s outdoor adventure,<br />service &amp; leadership club.</p><div className="sx-arrival-actions" inert={!atSummit}><button onClick={onJoin}>I’m in <ArrowUpRight size={17} /></button><a href="#basecamp" onClick={enter}>Meet the club <ArrowDown size={16} /></a></div></div>
        <div className="sx-bottom"><div className="sx-scroll-cue"><ArrowDown size={19} strokeWidth={1.3} /><span>{atSummit ? 'WELCOME TO SUMMIT' : 'SCROLL TO HIKE'}<small>{atSummit ? 'Keep going. Your crew is just below.' : 'Your pace. Stop anywhere. Scroll back to return.'}</small></span></div><span className="sx-field-note">{!ready ? 'PREPARING THE TRAIL…' : stop >= 0 ? `0${stop + 1} / 03` : 'OUTSIDE IS CALLING.'}</span></div>
      </div>
    </div></div>
    <div className="sx-underlay" ref={underlayRef} aria-hidden={!underlayVisible} inert={!underlayVisible}><div className="sx-arrival-strip"><span><Mountain size={15} /> THE HIKE ENDS. THE CLUB BEGINS.</span><button onClick={() => seekRef.current(0)}><RotateCcw size={13} /> Walk it again</button></div>{children}</div>
    <p className="sx-screen-reader">A cinematic mountain hike controlled entirely by your scroll position. The forest, wildlife, and mountain scenery are generated with Higgsfield. Skip directly to the club using the Club and signup link.</p>
  </section>;
}
