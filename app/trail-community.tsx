'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Camera, Check, Flag, ImagePlus, Leaf, Loader2, LockKeyhole, Mountain, Pencil, Star, Trash2, Trophy } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cloudClient, cloudConfigured, communityRequest } from '@/lib/cloud-client';
import type { BasecampState } from '@/lib/basecamp-client';
import { monthEnd, monthOptions, pacificDate, starLabels, type Gallery, type Hike, type HikePhoto, type MonthlyHikes } from '@/lib/trail-community';
import { prepareHikePhoto, removeHikePhoto, uploadHikePhoto } from '@/lib/hike-photo';
import HikeImage from './hike-image';
import './trail-community.css';

type Panel = { kind: 'rate'; hike: Hike } | { kind: 'upload' } | { kind: 'photo' | 'edit' | 'report' | 'delete'; photo: HikePhoto } | null;
export default function TrailCommunity({ account }: { account: BasecampState | null }) {
  const [month, setMonth] = useState(() => monthOptions()[0].value);
  const [ratings, setRatings] = useState<MonthlyHikes | null>(null), [photos, setPhotos] = useState<HikePhoto[]>([]), [hasMore, setHasMore] = useState(false);
  const [ready, setReady] = useState(false), [authRevision, setAuthRevision] = useState(0), [view, setView] = useState<'crew' | 'mine'>('crew'), [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(false), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [panel, setPanel] = useState<Panel>(null), [stars, setStars] = useState(0), [hoverStar, setHoverStar] = useState(0), [photo, setPhoto] = useState<Blob | null>(null), [preview, setPreview] = useState('');
  const section = useRef<HTMLElement>(null), requests = useRef(0), photoVersion = useRef(0), pending = useRef(false), accountId = useRef<string | null>(null), uploadId = useRef(''), fileInput = useRef<HTMLInputElement>(null);
  const canParticipate = cloudConfigured && !!account?.member && !!account.signedIn;
  const today = ratings?.today || pacificDate(), months = monthOptions(today);
  const hikes = ratings?.hikes ?? [];
  const canUpload = cloudConfigured && hikes.length > 0 && !loading && !busy;
  const emptyCatalog = !!ratings && !hikes.length;
  const load = useCallback(async () => {
    if (!cloudConfigured) return;
    const version = ++requests.current; setLoading(true); setError('');
    try {
      const result = await communityRequest<MonthlyHikes>('ratings', { month });
      const gallery = canParticipate ? await communityRequest<Gallery>(view === 'mine' ? 'my_photos' : 'gallery', { hike_id: filter }) : { photos: [] };
      if (version !== requests.current) return;
      setRatings(result); setPhotos(view === 'mine' ? gallery.photos : gallery.photos.slice(0, 24)); setHasMore(view === 'crew' && gallery.photos.length > 24);
    } catch (e) { if (version === requests.current) setError(e instanceof Error ? e.message : 'Could not load the trail community.'); }
    finally { if (version === requests.current) setLoading(false); }
  }, [month, canParticipate, view, filter]);
  useEffect(() => {
    const element = section.current; if (!element) return;
    const observer = new IntersectionObserver(entries => { if (entries.some(entry => entry.isIntersecting)) { setReady(true); observer.disconnect(); } }, { rootMargin: '500px' });
    observer.observe(element); return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!ready) return;
    // Synchronize with the external monthly ratings and gallery service.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load(); const reads = requests;
    return () => { reads.current++; };
  }, [ready, load, authRevision]);
  useEffect(() => {
    if (!cloudConfigured) return;
    const { data } = cloudClient().auth.onAuthStateChange((event, session) => {
      if (event === 'INITIAL_SESSION') accountId.current = session?.user.id || null;
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user.id !== accountId.current)) { accountId.current = session?.user.id || null; requests.current++; photoVersion.current++; setPhotos([]); setRatings(null); setPanel(null); setPhoto(null); setAuthRevision(value => value + 1); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!ready || !cloudConfigured) return;
    const update = () => { if (!pending.current && !panel && photos.length <= 24 && document.visibilityState === 'visible') void load(); };
    window.addEventListener('focus', update); window.addEventListener('summit:gallery-change', update); const timer = window.setInterval(update, 60000);
    return () => { window.removeEventListener('focus', update); window.removeEventListener('summit:gallery-change', update); clearInterval(timer); };
  }, [ready, load, panel, photos.length]);
  useEffect(() => {
    // Allocate and release only the selected local image's preview resource.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!photo) { setPreview(''); return; }
    const url = URL.createObjectURL(photo); setPreview(url); return () => URL.revokeObjectURL(url);
  }, [photo]);
  function open(next: Panel) { if (next?.kind === 'upload' && !canUpload) return; setError(''); setNotice(''); setPanel(next); if (next?.kind === 'rate') { setStars(next.hike.my_rating?.stars || 0); setHoverStar(0); } if (next?.kind === 'upload') { setPhoto(null); uploadId.current = crypto.randomUUID(); } }
  async function work(key: string, task: () => Promise<void>) {
    if (pending.current) return; pending.current = true; requests.current++; setBusy(key); setError(''); setNotice('');
    try { await task(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Try again.'); }
    finally { pending.current = false; setBusy(''); }
  }
  async function rate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (panel?.kind !== 'rate' || !stars) return;
    const fields = new FormData(event.currentTarget), hike = panel.hike;
    await work('rate', async () => {
      await communityRequest('rate', { hike_id: hike.id, stars, hiked_on: fields.get('hiked_on'), hiked: fields.get('hiked') === 'on' });
      setPanel(null); setNotice(`Your ${stars}-star rating is saved.`); await load();
    });
  }
  async function choosePhoto(file?: File) {
    if (!file) return;
    const version = ++photoVersion.current;
    await work('prepare', async () => { const result = await prepareHikePhoto(file); if (version === photoVersion.current) { setPhoto(result); uploadId.current = crypto.randomUUID(); } });
    if (fileInput.current) fileInput.current.value = '';
  }
  async function sharePhoto(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!photo) { setError('Choose a photo first.'); return; }
    const fields = new FormData(event.currentTarget);
    await work('upload', async () => {
      await uploadHikePhoto(photo, { id: uploadId.current, hike_id: fields.get('hike_id'), hiked_on: fields.get('hiked_on'), caption: fields.get('caption'), alt_text: fields.get('alt_text'), consent: fields.get('consent') === 'on' });
      setPhoto(null); setPanel(null); setNotice('Photo shared with SUMMIT members.'); await load();
    });
  }
  async function more() {
    if (!photos.length) return;
    await work('more', async () => {
      const last = photos[photos.length - 1];
      const next = await communityRequest<Gallery>('gallery', { hike_id: filter, before_at: last.published_at, before_id: last.id });
      setPhotos(current => [...current, ...next.photos.slice(0, 24).filter(photo => !current.some(existing => existing.id === photo.id))]); setHasMore(next.photos.length > 24);
    });
  }
  const joinPrompt = <div className="trail-auth"><LockKeyhole size={24}/><h3>{account?.signedIn ? 'Join the crew first.' : 'This part is for the crew.'}</h3><p>{account?.signedIn ? 'Finish your registration to rate hikes and share your photos.' : 'Sign in and register to rate hikes, see member photos, and share your own.'}</p><Link className="trail-button" href={account?.signedIn ? '/register/' : '/profile/'}>{account?.signedIn ? 'Finish registration' : 'Sign in to SUMMIT'} <ArrowUpRight size={16}/></Link></div>;
  return <section className="trail-community section" id="trail-community" ref={section} aria-labelledby="trail-community-title">
    <div className="trail-section-label"><span>OUT THERE, TOGETHER</span><span>THE SUMMIT COMMUNITY</span></div>
    <div className="trail-month-heading"><div><span className="trail-kicker"><Trophy size={15}/> RATED BY THE CREW</span><h2 id="trail-community-title">Top hikes<br/>of the month.</h2><p>The trails you loved. The ones worth going back for.</p></div><label className="trail-month">THE MONTH<select aria-label="Rating month" value={month} disabled={!ratings || loading || !!busy} onChange={event => setMonth(event.target.value)}>{months.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label></div>
    {!cloudConfigured && <p className="trail-connection-note">Member ratings and photo uploads open once online accounts are connected.</p>}
    {cloudConfigured && (loading || (!ratings && !error)) && <p className="trail-fine" role="status">Loading the trail board…</p>}
    {error && !panel && <p className="trail-error" role="alert">{error}<button onClick={() => void load()} disabled={loading || !!busy}>Try again</button></p>}
    {notice && <p className="trail-notice" role="status"><Check size={16}/>{notice}</p>}
    {emptyCatalog && !loading && !error && <div className="trail-catalog-empty" role="status"><Mountain size={26} aria-hidden="true"/><div><h3>No trails listed yet.</h3><p>Tobias will add the trails here. Then you can rate the ones you’ve hiked and share your photos.</p>{account?.leader && <Link className="trail-text-button" href="/leadership/">Manage the trail list <ArrowUpRight size={16}/></Link>}</div></div>}
    <div className="trail-ranking">{hikes.map(hike => <article key={hike.id} className={`trail-rank-row ${hike.rank === 1 ? 'is-first' : ''}`}><div className="trail-rank-number">{hike.rank ? String(hike.rank).padStart(2, '0') : <Mountain size={23}/>}</div><div className="trail-rank-name">{hike.rank === 1 && <span className="trail-winner">THIS MONTH’S FAVORITE</span>}<h3>{hike.name}</h3><p>{hike.area}</p><a href={hike.official_url} target="_blank" rel="noopener noreferrer">Official trail info <ArrowUpRight size={12}/></a></div><div className="trail-score"><span><Star size={16} fill={hike.rating_count ? 'currentColor' : 'none'}/><strong>{hike.average == null ? '—' : Number(hike.average).toFixed(1)}</strong><small>/ 5</small></span><p>{!ratings && cloudConfigured ? (error ? 'Ratings unavailable' : 'Loading ratings…') : hike.rating_count ? `${hike.rating_count} ${hike.rating_count === 1 ? 'rating' : 'ratings'}` : 'No ratings yet'}</p>{hike.rating_count > 0 && !hike.rank && <small>{3 - hike.rating_count} more to rank</small>}</div><button className="trail-rate-button" disabled={!cloudConfigured || !ratings || loading || !!busy} onClick={() => open({ kind: 'rate', hike })}>{hike.my_rating ? `Your rating · ${hike.my_rating.stars} ★` : 'Rate this hike'}<ArrowUpRight size={15}/></button></article>)}</div>
    <details className="trail-ranking-explainer"><summary>How the ranking works</summary><p>One rating per member, per trail, per month you hiked it. You can change or remove yours. A hike needs at least three members’ ratings to rank. Higher average comes first, then more ratings, then alphabetical order. Months follow Pacific time.</p><p>These are member-rated trails, not scheduled club outings. Official trail links have current visitor information.</p></details>
    <div className="trail-gallery-heading" id="trail-photos"><div><span className="trail-kicker"><Camera size={16}/> THE CAMERA ROLL</span><h2>A little proof<br/>you got outside.</h2><p>Your people. Your hikes. Your favorite moments along the way.</p></div><button className="trail-button" disabled={!canUpload} aria-describedby={emptyCatalog ? "trail-upload-note" : undefined} onClick={() => open({ kind: 'upload' })}><ImagePlus size={17}/> Add a hike photo</button></div>
    {emptyCatalog && <p className="trail-connection-note" id="trail-upload-note">Photo uploads open once Tobias adds a trail.</p>}
    {canParticipate && <div className="trail-gallery-tools"><div className="trail-gallery-tabs" aria-label="Photo collection"><button aria-pressed={view === 'crew'} disabled={!!busy} onClick={() => setView('crew')}>The crew</button><button aria-pressed={view === 'mine'} disabled={!!busy} onClick={() => setView('mine')}>My photos</button></div>{view === 'crew' && <label>Trail<select aria-label="Filter photos by trail" value={filter} disabled={loading || !!busy} onChange={event => setFilter(event.target.value)}><option value="">All trails</option>{hikes.map(hike => <option key={hike.id} value={hike.id}>{hike.name}</option>)}</select></label>}<span><LockKeyhole size={12}/> Members only</span></div>}
    {photos.length ? <div className="trail-photo-grid">{photos.map(item => <article className="trail-photo-card" key={item.id}><button className="trail-photo-open" onClick={() => open({ kind: 'photo', photo: item })} aria-label={`Open photo: ${item.alt_text}`}><HikeImage path={item.object_path} alt={item.alt_text}/><span><ArrowUpRight size={19}/></span></button><div className="trail-photo-caption"><p>{item.hike_name}</p>{item.caption && <h3>{item.caption}</h3>}<span>By {item.author_name}</span>{item.status !== 'published' && <small className="trail-photo-status">{item.status === 'draft' ? 'Unfinished upload' : item.status === 'hidden' ? 'Hidden by leadership' : 'Deletion needs finishing'}</small>}<div><button onClick={() => open({ kind: item.mine ? 'delete' : 'report', photo: item })}>{item.mine ? <Trash2 size={13}/> : <Flag size={13}/>} {item.mine ? 'Remove' : 'Report'}</button>{item.mine && item.status === 'published' && <button onClick={() => open({ kind: 'edit', photo: item })}><Pencil size={13}/> Edit caption</button>}</div></div></article>)}</div>
      : <div className="trail-gallery-empty"><div className="trail-empty-art" aria-hidden="true"><span/><Mountain size={72} strokeWidth={.8}/><Leaf size={28} strokeWidth={1}/></div><div><span className="trail-kicker">LEAVE THE SCROLL. KEEP THE MEMORIES.</span><h3>{canParticipate ? view === 'mine' ? 'Your first photo belongs here.' : 'A whole lot of stories to come.' : 'Some things are better shared with the crew.'}</h3><p>{canParticipate ? (hikes.length ? 'Share a summit smile, a trail-side moment, or the view that made you stop.' : 'Your hike photos will appear here, shared with the club.') : 'Hike photos are shared with registered SUMMIT members. Sign in to see them and add yours.'}</p>{canParticipate ? hikes.length > 0 && <button className="trail-text-button" disabled={!canUpload} onClick={() => open({ kind: 'upload' })}>Start the camera roll <ArrowUpRight size={16}/></button> : <Link className="trail-text-button" href="/profile/">Meet your crew <ArrowUpRight size={16}/></Link>}</div></div>}
    {hasMore && <button className="trail-load-more" disabled={!!busy} onClick={() => void more()}>{busy === 'more' ? 'Loading…' : 'More from the trail'}</button>}
    <p className="trail-gallery-note"><LockKeyhole size={12}/> Photos stay inside the club. Share only photos you have permission to post. You can remove yours anytime.</p>
    <Dialog open={!!panel} onOpenChange={value => { if (!value && !busy) { photoVersion.current++; setPanel(null); setPhoto(null); } }}><DialogContent className="trail-dialog"><DialogTitle>{panel?.kind === 'rate' ? panel.hike.name : panel?.kind === 'upload' ? 'From your camera roll.' : panel?.kind === 'report' ? 'Report a photo' : panel?.kind === 'delete' ? 'Remove this photo?' : panel?.kind === 'edit' ? 'A few words from the trail.' : panel?.kind === 'photo' ? panel.photo.hike_name : 'Trail community'}</DialogTitle><DialogDescription>{panel?.kind === 'rate' ? 'Been there? Tell the crew how it was.' : panel?.kind === 'upload' ? 'A moment from the hike, shared with registered SUMMIT members.' : panel?.kind === 'delete' ? 'The photo and its caption will be removed from the club gallery.' : panel?.kind === 'report' ? 'Approved club leaders can review your concern and hide the photo.' : panel?.kind === 'edit' ? 'Update your caption and accessible photo description.' : 'A moment from the SUMMIT community.'}</DialogDescription>
      {!canParticipate ? joinPrompt : panel?.kind === 'rate' ? <form className="trail-form" onSubmit={rate}><fieldset className="trail-stars"><legend>Your rating</legend><div onMouseLeave={() => setHoverStar(0)}>{starLabels.map((label, index) => <label key={label} onMouseEnter={() => setHoverStar(index + 1)}><input type="radio" name="stars" value={index + 1} checked={stars === index + 1} onChange={() => setStars(index + 1)} aria-label={`${index + 1} ${index ? 'stars' : 'star'} — ${label}`} required disabled={!!busy}/><Star size={34} strokeWidth={1.3} fill={(hoverStar || stars) > index ? 'currentColor' : 'none'}/></label>)}</div><p>{starLabels[(hoverStar || stars) - 1] || 'Pick one to five stars'}</p></fieldset><label>When did you hike it?<input type="date" name="hiked_on" defaultValue={panel.hike.my_rating?.hiked_on || monthEnd(month, today)} min={month} max={monthEnd(month, today)} required disabled={!!busy}/></label><label className="trail-consent"><input type="checkbox" name="hiked" required disabled={!!busy}/><span>I’ve personally hiked this trail.</span></label><button className="trail-button" disabled={!stars || !!busy}>{busy === 'rate' ? 'Saving…' : panel.hike.my_rating ? 'Update my rating' : 'Save my rating'}</button>{panel.hike.my_rating && <button type="button" className="trail-text-button" disabled={!!busy} onClick={() => void work('remove-rating', async () => { await communityRequest('remove_rating', { hike_id: panel.hike.id, month }); setPanel(null); setNotice('Your rating was removed.'); await load(); })}>Remove my rating</button>}</form>
        : panel?.kind === 'upload' ? <form className="trail-form" onSubmit={sharePhoto}><input ref={fileInput} className="trail-file-input" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a hike photo" disabled={!!busy} onChange={event => void choosePhoto(event.target.files?.[0])}/><button type="button" className={`trail-upload-area ${preview ? 'has-photo' : ''}`} disabled={!!busy} onClick={() => fileInput.current?.click()}>{preview ? <><img src={preview} alt="Your selected hike photo preview"/><span>Change photo</span></> : <><ImagePlus size={30}/><strong>{busy === 'prepare' ? 'Preparing your photo…' : 'Choose a photo'}</strong><span>JPG, PNG, or WebP · Up to 10 MB</span></>}</button><div className="trail-form-row"><label>The trail<select name="hike_id" required disabled={!!busy}><option value="">Choose your hike</option>{hikes.map(hike => <option key={hike.id} value={hike.id}>{hike.name}</option>)}</select></label><label>Hike date<input type="date" name="hiked_on" required defaultValue={today} max={today} min="2000-01-01" disabled={!!busy}/></label></div><label>A caption, if you like<textarea name="caption" maxLength={240} rows={2} placeholder="The view was worth the early alarm." disabled={!!busy}/></label><label>Describe the photo<input name="alt_text" minLength={5} maxLength={180} required placeholder="Three friends on a trail overlooking the coast" disabled={!!busy}/><small>Helps members using screen readers enjoy the moment too.</small></label><label className="trail-consent"><input type="checkbox" name="consent" required disabled={!!busy}/><span>I have permission to share this photo, including permission from people pictured. It will be visible to SUMMIT members with my display name.</span></label><button className="trail-button" disabled={!photo || !!busy}>{busy === 'upload' ? <><Loader2 size={16} className="spin"/> Sharing…</> : <><Camera size={16}/> Share with the crew</>}</button><p className="trail-fine">We resize the photo and remove original location metadata. If your trail isn’t listed, ask club leadership to add it.</p></form>
        : panel?.kind === 'photo' ? <div className="trail-photo-detail"><HikeImage path={panel.photo.object_path} alt={panel.photo.alt_text}/><p>{panel.photo.caption}</p><span>By {panel.photo.author_name} · Hiked {new Date(panel.photo.hiked_on + 'T12:00:00Z').toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
        : panel?.kind === 'edit' ? <form className="trail-form" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void work('edit', async () => { await communityRequest('photo_edit', { id: panel.photo.id, caption: fields.get('caption'), alt_text: fields.get('alt_text') }); setPanel(null); setNotice('Caption updated.'); await load(); }); }}><label>Caption<textarea name="caption" maxLength={240} defaultValue={panel.photo.caption} rows={3} disabled={!!busy}/></label><label>Describe the photo<input name="alt_text" minLength={5} maxLength={180} required defaultValue={panel.photo.alt_text} disabled={!!busy}/></label><button className="trail-button" disabled={!!busy}>Save caption</button></form>
        : panel?.kind === 'report' ? <form className="trail-form" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void work('report', async () => { await communityRequest('report_photo', { id: panel.photo.id, reason: fields.get('reason') }); setPanel(null); setNotice('Your concern was sent to club leadership.'); }); }}><label>What’s the concern?<select name="reason" required disabled={!!busy}>{['Permission concern','Inappropriate photo','Wrong trail or spam'].map(reason => <option key={reason}>{reason}</option>)}</select></label><button className="trail-button" disabled={!!busy}>Send concern</button></form>
        : panel?.kind === 'delete' ? <div className="trail-form"><p>You can upload it again later if you change your mind.</p><button className="trail-button trail-danger" disabled={!!busy} onClick={() => void work('delete', async () => { await removeHikePhoto(panel.photo.id); setPanel(null); setNotice('Photo removed.'); await load(); })}><Trash2 size={16}/>{busy === 'delete' ? 'Removing…' : 'Remove photo'}</button><button className="trail-text-button" disabled={!!busy} onClick={() => setPanel(null)}>Keep it</button></div> : null}
      {error && <p className="trail-error" role="alert">{error}</p>}
    </DialogContent></Dialog>
  </section>;
}
