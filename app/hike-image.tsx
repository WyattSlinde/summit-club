'use client';
import { useEffect, useRef, useState } from 'react';
import { ImageOff } from 'lucide-react';
import { cloudClient } from '@/lib/cloud-client';
/** Authenticated reads are checked by Storage RLS; no public student-photo URLs. */
export default function HikeImage({ path, alt, className }: { path: string; alt: string; className?: string }) {
  const frame = useRef<HTMLElement | null>(null);
  const [image, setImage] = useState({ key: '', url: '', failed: false });
  useEffect(() => {
    let cancelled = false, objectUrl = '';
    const load = () => { void cloudClient().storage.from('hike-photos').download(path).then(({ data, error }) => {
      if (cancelled) return;
      if (error || !data) { setImage({ key: path, url: '', failed: true }); return; }
      objectUrl = URL.createObjectURL(data); setImage({ key: path, url: objectUrl, failed: false });
    }).catch(() => { if (!cancelled) setImage({ key: path, url: '', failed: true }); }); };
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); load(); } }, { rootMargin: '300px' });
    if (frame.current) observer.observe(frame.current);
    return () => { cancelled = true; observer.disconnect(); if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path]);
  return image.key === path && image.url ? <img ref={element => { frame.current = element; }} className={className} src={image.url} alt={alt} loading="lazy" decoding="async"/> : <div ref={element => { frame.current = element; }} className={`${className || ''} hike-photo-loading`} role="status">{image.key === path && image.failed ? <><ImageOff size={24}/><span>Photo unavailable</span></> : <span>Loading photo…</span>}</div>;
}
