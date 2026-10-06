'use client';

import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { ArrowDownToLine, Check, Triangle } from 'lucide-react';
import './summit-pass.css';

type SummitPassMember = {
  name: string;
  grade: string;
  interest: string;
  created_at: string;
};

function passReference(member: SummitPassMember) {
  const value = `${member.name}|${member.created_at}`;
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
}

function xml(value: string) {
  return value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  }[character]!));
}

function nameLines(name: string) {
  const words = name.trim().split(/\s+/).flatMap(word => word.match(/.{1,24}/g) || []);
  const lines: string[] = [];
  for (const word of words) {
    const last = lines.length - 1;
    if (last >= 0 && `${lines[last]} ${word}`.length <= 24) lines[last] += ` ${word}`;
    else lines.push(word);
  }
  return lines.slice(0, 4);
}

function barcode(reference: string) {
  return Array.from({ length: 48 }, (_, i) => ({
    x: i * 4,
    width: 1 + (parseInt(reference[i % reference.length], 16) + i) % 3,
  }));
}

function createPassSvg(member: SummitPassMember, reference: string) {
  const lines = nameLines(member.name);
  const nameSize = lines.length > 3 ? 43 : lines.length > 2 ? 48 : 61;
  const lineHeight = nameSize + 6;
  const nameTop = lines.length > 2 ? 206 : 235;
  const bars = barcode(reference).map(bar => `<rect x="${824 + bar.x * .55}" y="424" width="${bar.width * .55}" height="68" fill="#0b1914"/>`).join('');
  const name = lines.map((line, index) => `<tspan x="62" y="${nameTop + index * lineHeight}">${xml(line.toUpperCase())}</tspan>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="620" viewBox="0 0 1000 620" role="img" aria-labelledby="pass-title pass-description">
  <title id="pass-title">SUMMIT field pass for ${xml(member.name)}</title>
  <desc id="pass-description">Cathedral Catholic High School. Interest registered. This is a personal club-interest record, not an event reservation or permission slip.</desc>
  <defs><clipPath id="pass-shape"><path d="M24 0H976L1000 24V596L976 620H24L0 596V24Z"/></clipPath></defs><g clip-path="url(#pass-shape)">
  <path d="M24 0H976L1000 24V596L976 620H24L0 596V24Z" fill="#e8e5d4"/>
  <path d="M0 0H784V620H0Z" fill="#0b1914"/>
  <path d="M62 98L84 58L106 98Z" fill="none" stroke="#dda66b" stroke-width="4"/>
  <text x="125" y="98" fill="#e8e5d4" font-family="Arial,Helvetica,sans-serif" font-size="47" font-weight="900" letter-spacing="-2">SUMMIT</text>
  <text x="62" y="136" fill="#aeb5b5" font-family="monospace" font-size="12" letter-spacing="2">CATHEDRAL CATHOLIC HIGH SCHOOL</text>
  <path d="M62 162H722" stroke="#e8e5d4" stroke-opacity=".25"/>
  <text fill="#e8e5d4" font-family="Arial,Helvetica,sans-serif" font-weight="900" font-size="${nameSize}" letter-spacing="-2">${name}</text>
  <text x="62" y="414" fill="#aeb5b5" font-family="monospace" font-size="12" letter-spacing="2">GRADE</text>
  <text x="62" y="446" fill="#e8e5d4" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="700">${xml(member.grade)}</text>
  <text x="258" y="414" fill="#aeb5b5" font-family="monospace" font-size="12" letter-spacing="2">HERE FOR</text>
  <text x="258" y="446" fill="#e8e5d4" font-family="Arial,Helvetica,sans-serif" font-size="25" font-weight="700">${xml(member.interest.toUpperCase())}</text>
  <rect x="62" y="482" width="660" height="53" fill="#dda66b"/>
  <path d="M83 508L90 515L104 501" stroke="#0b1914" fill="none" stroke-width="3"/>
  <text x="126" y="516" fill="#0b1914" font-family="monospace" font-size="19" font-weight="700" letter-spacing="3">INTEREST REGISTERED</text>
  <text x="62" y="576" fill="#aeb5b5" font-family="monospace" font-size="12">EXPLORE. SERVE. LEAD.</text>
  <path d="M784 26V594" stroke="#0b1914" stroke-width="3" stroke-dasharray="5 9"/>
  <text x="827" y="81" fill="#0b1914" font-family="monospace" font-size="12" letter-spacing="2">FIELD PASS</text>
  <text transform="translate(847 125) rotate(90)" fill="#0b1914" font-family="Arial,Helvetica,sans-serif" font-size="54" font-weight="900" letter-spacing="-2">GET OUT THERE.</text>
  ${bars}
  <text x="827" y="528" fill="#0b1914" font-family="monospace" font-size="11">DESIGN REF.</text>
  <text x="827" y="549" fill="#0b1914" font-family="monospace" font-size="17">${reference}</text>
  </g></svg>`;
}

export default function SummitPass({ member }: { member: SummitPassMember }) {
  const card = useRef<HTMLDivElement>(null);
  const reduceMotion = useRef(false);
  const [downloaded, setDownloaded] = useState(false);
  const [downloadError, setDownloadError] = useState('');
  const reference = passReference(member);

  useEffect(() => {
    const media = matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => { reduceMotion.current = media.matches; };
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  function tilt(event: PointerEvent<HTMLDivElement>) {
    if (!card.current || reduceMotion.current || event.pointerType !== 'mouse') return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - .5;
    const y = (event.clientY - rect.top) / rect.height - .5;
    card.current.style.setProperty('--pass-rotate-x', `${y * -8}deg`);
    card.current.style.setProperty('--pass-rotate-y', `${x * 9}deg`);
    card.current.style.setProperty('--pass-light-x', `${(x + .5) * 100}%`);
  }

  function reset() {
    card.current?.style.setProperty('--pass-rotate-x', '0deg');
    card.current?.style.setProperty('--pass-rotate-y', '0deg');
  }

  function download() {
    let url: string | undefined;
    try {
      setDownloadError('');
      url = URL.createObjectURL(new Blob([createPassSvg(member, reference)], { type: 'image/svg+xml;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `SUMMIT-field-pass-${reference}.svg`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setDownloaded(true);
    } catch {
      setDownloadError('The pass could not be downloaded. Please try again.');
    } finally {
      if (url) setTimeout(() => URL.revokeObjectURL(url!), 1000);
    }
  }

  return <div className="summit-pass-wrap">
    <div className="summit-pass-perspective" onPointerMove={tilt} onPointerLeave={reset}>
      <div className="summit-field-pass" ref={card}>
        <div className="summit-pass-main">
          <div className="summit-pass-brand"><Triangle aria-hidden="true" size={30} /><strong>SUMMIT</strong><span>FIELD<br />PASS</span></div>
          <p className="summit-pass-school">CATHEDRAL CATHOLIC HIGH SCHOOL</p>
          <div className="summit-pass-name"><span>YOUR NEXT CHAPTER STARTS OUTSIDE</span><h3>{member.name}</h3></div>
          <dl className="summit-pass-details"><div><dt>GRADE</dt><dd>{member.grade}</dd></div><div><dt>HERE FOR</dt><dd>{member.interest}</dd></div></dl>
          <div className="summit-pass-stamp"><Check size={18} aria-hidden="true" /><span>INTEREST REGISTERED</span></div>
          <p className="summit-pass-motto">EXPLORE. SERVE. LEAD.</p>
        </div>
        <div className="summit-pass-stub" aria-hidden="true">
          <span className="summit-pass-stub-top">SUMMIT / CC</span>
          <strong>GET OUT THERE.</strong>
          <svg className="summit-pass-barcode" viewBox="0 0 192 44" preserveAspectRatio="none">{barcode(reference).map((bar, index) => <rect key={index} x={bar.x} y="0" width={bar.width} height="44" />)}</svg>
          <span className="summit-pass-reference">DESIGN REF.<b>{reference}</b></span>
        </div>
      </div>
    </div>
    <div className="summit-pass-actions"><p>Your interest. On record.<br /><span>Keep a little reminder to get outside.</span></p><button type="button" className="summit-pass-download" onClick={download}>{downloaded ? <Check size={17} /> : <ArrowDownToLine size={17} />}<span>{downloaded ? 'Download again' : 'Save field pass'}<small>SVG IMAGE</small></span></button></div>
    {downloaded && <p className="summit-pass-download-status" role="status">Your SVG field pass is ready to save.</p>}
    {downloadError && <p className="summit-pass-download-error" role="alert">{downloadError}</p>}
  </div>;
}
