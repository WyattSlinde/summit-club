'use client';

import { useEffect, useId, useRef, type CSSProperties } from 'react';
import { sitePath } from '@/lib/site-path';
import { BRAND_COLUMNS, BRAND_DURATION, BRAND_FRAMES, BRAND_TILE, paintBrandPose } from '@/lib/brand-motion';
import './summit-brand.css';

type Motion = 'still' | 'entrance' | 'scroll';
type Props = { className?: string; motion?: Motion; active?: boolean };

const letters = 'M85 0H20L0 20V54L20 73H58V99H0V124H66L87 103V67L67 48H29V25H85Z M104 0H132V91Q132 100 145 100Q158 100 158 91V0H186V95Q186 124 145 124Q104 124 104 95Z M205 124V25L230 0L255 49L280 0L305 25V124H277V53L255 91L233 53V124Z M324 124V25L349 0L374 49L399 0L424 25V124H396V53L374 91L352 53V124Z M445 0H474V124H445Z M493 0H612V26H567V124H538V26H493Z';
const mountain = 'M4 48 25 13 40 37 47 27 60 48H4Z';
const pine = 'M0 0-4 7H-2L-6 13H-3L-8 20H-1V24H1V20H8L3 13H6L2 7H4Z';
const trees = [[18,88,1.5],[65,73,2.1],[118,71,2.3],[173,87,1.6],[216,76,2],[288,67,2.6],[338,83,1.8],[407,74,2.2],[458,68,2.5],[550,75,2.2]];

/** One short entrance, then rest. Hover/focus can replay it; hidden logos do no work. */
function useBrandEntrance(motion: Motion, active: boolean) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || motion !== 'entrance') return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let frame = 0, visible = false, started = false;
    const finish = () => { cancelAnimationFrame(frame); frame = 0; paintBrandPose(element, 1); };
    const play = () => {
      if (!active || !visible || reduced.matches || document.hidden || frame) return;
      started = true;
      const start = performance.now();
      paintBrandPose(element, 0);
      const tick = (now: number) => {
        const progress = Math.min(1, (now - start) / BRAND_DURATION);
        paintBrandPose(element, progress);
        frame = progress < 1 ? requestAnimationFrame(tick) : 0;
      };
      frame = requestAnimationFrame(tick);
    };
    finish();
    if (!active) return finish;
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      if (!visible) finish();
      else if (!started) play();
    }, { threshold: .15 });
    observer.observe(element);
    const target = element.closest('a') || element;
    const preferenceChanged = () => { if (reduced.matches) finish(); };
    const visibilityChanged = () => { if (document.hidden) finish(); };
    target.addEventListener('pointerenter', play);
    target.addEventListener('focusin', play);
    reduced.addEventListener('change', preferenceChanged);
    document.addEventListener('visibilitychange', visibilityChanged);
    return () => {
      finish(); observer.disconnect();
      target.removeEventListener('pointerenter', play);
      target.removeEventListener('focusin', play);
      reduced.removeEventListener('change', preferenceChanged);
      document.removeEventListener('visibilitychange', visibilityChanged);
    };
  }, [motion, active]);
  return ref;
}

/** One cached Higgsfield sprite sheet, with no video decoder or autoplay on the page. */
function ForestTexture({ width, height }: { width: number; height: number }) {
  return <svg width={width} height={height} viewBox={`0 0 ${BRAND_TILE.width} ${BRAND_TILE.height}`} preserveAspectRatio="xMidYMid slice" className="brand-forest-texture" style={{ "--brand-final-x": `${-((BRAND_FRAMES - 1) % BRAND_COLUMNS) * BRAND_TILE.width}px`, "--brand-final-y": `${-Math.floor((BRAND_FRAMES - 1) / BRAND_COLUMNS) * BRAND_TILE.height}px` } as CSSProperties}>
    <image className="brand-forest-frames" href={sitePath('/brand/forest-motion.webp')} width={BRAND_TILE.width * BRAND_COLUMNS} height={BRAND_TILE.height * Math.ceil(BRAND_FRAMES / BRAND_COLUMNS)}/>
  </svg>;
}

/** Original sharp vector lettering; a living forest appears only in the two large reveals. */
export function SummitWordmark({ className = '', motion = 'still', active = true }: Props) {
  const id = `summit-type-${useId().replace(/:/g, '')}`;
  const ref = useBrandEntrance(motion, active);
  const living = motion !== 'still';
  return <svg ref={ref} className={`summit-wordmark ${living ? 'summit-living-type' : ''} ${className}`} data-brand-motion={motion} viewBox="0 0 612 124" fill="currentColor" aria-hidden="true" focusable="false">
    <path d={letters}/>
    {living && <>
      <defs><clipPath id={id}><path d={letters}/></clipPath><linearGradient id={`${id}-light`}><stop stopColor="#fff5dd" stopOpacity="0"/><stop offset=".5" stopColor="#fff5dd" stopOpacity=".8"/><stop offset="1" stopColor="#fff5dd" stopOpacity="0"/></linearGradient></defs>
      <g clipPath={`url(#${id})`}>
        <ForestTexture width={612} height={124}/>
        <g className="brand-letter-pines">{trees.map(([x,y,scale]) => <g key={x} transform={`translate(${x} ${y}) scale(${scale})`}><path className="brand-pine" d={pine}/></g>)}</g>
        <path className="brand-type-trail" d="M-8 134C93 130 111 53 211 81S351 120 411 62S536 30 633 10" pathLength="1"/>
        <rect className="brand-sunlight" x="0" y="0" width="160" height="124" fill={`url(#${id}-light)`}/>
      </g>
      <path className="brand-letter-edge" d={letters}/>
    </>}
  </svg>;
}

export function SummitMark({ className = '', motion = 'still', active = true }: Props) {
  const id = `summit-crest-${useId().replace(/:/g, '')}`;
  const ref = useBrandEntrance(motion, active);
  const living = motion !== 'still';
  return <svg ref={ref} className={`summit-mark ${living ? 'summit-living-mark' : ''} ${className}`} data-brand-motion={motion} viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
    {living && <><defs><clipPath id={id}><path d={mountain}/></clipPath></defs><path d={mountain} fill="var(--forest-deep, #10231d)"/><g clipPath={`url(#${id})`}><ForestTexture width={64} height={54}/></g></>}
    <g className={living ? 'brand-sun' : ''}><circle cx="46" cy="15" r="6" fill="currentColor"/>{living && <circle className="brand-sun-orbit" cx="46" cy="15" r="9"/>}</g>
    <path d={mountain} stroke="currentColor" strokeWidth="2.5" strokeLinejoin="round"/>
    <path d="m19 24 6 6 5-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    {living && <g clipPath={`url(#${id})`} className="brand-crest-pines"><g transform="translate(14 35) scale(.55)"><path className="brand-pine" d={pine}/></g><g transform="translate(21 28) scale(.86)"><path className="brand-pine" d={pine}/></g><g transform="translate(50 34) scale(.61)"><path className="brand-pine" d={pine}/></g></g>}
    <path className={living ? 'brand-crest-trail' : ''} d="M30 57 40 46 27 40 35 30" pathLength="1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>;
}
