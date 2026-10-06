'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { communityRequest } from '@/lib/cloud-client';
import type { HikePhoto } from '@/lib/trail-community';
import HikeImage from './hike-image';
import './trail-community.css';
type Data = { hikes: { id: string; name: string; area: string; active: boolean }[]; photos: (HikePhoto & { reports: number; reasons: string[] })[] };
export default function CommunityDesk() {
  const [data, setData] = useState<Data | null>(null), [error, setError] = useState(''), [busy, setBusy] = useState(false), [notice, setNotice] = useState('');
  const version = useRef(0), saving = useRef(false);
  const load = useCallback(async () => { const request = ++version.current; try { const result = await communityRequest<Data>('leader'); if (request === version.current) setData(result); } catch (e) { if (request === version.current) setError(e instanceof Error ? e.message : 'Could not load the gallery desk.'); } }, []);
  // Synchronize the desk with the external authorized gallery service.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); const reads = version; return () => { reads.current++; }; }, [load]);
  async function save(payload: Record<string, unknown>) {
    if (saving.current) return false; saving.current = true; setBusy(true); setError(''); setNotice(''); version.current++;
    try { setData(await communityRequest<Data>('leader', payload)); window.dispatchEvent(new Event('summit:gallery-change')); return true; }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save.'); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    if (await save({ verb: 'add_hike', name: fields.get('name'), area: fields.get('area'), official_url: fields.get('official_url') })) { form.reset(); setNotice('Trail added. Members can rate it and share photos.'); }
  }
  return <div className="community-desk">{error && <p role="alert" className="error">{error} <button disabled={busy} onClick={() => { setError(''); void load(); }}>Retry</button></p>}{notice && <p role="status" className="desk-notice">{notice}</p>}{!data && !error && <p role="status">Loading hikes and photos…</p>}{data && <><details><summary>Manage the trail list ({data.hikes.length})</summary><p className="fine">Use specific, real trails and an official park information link. This list does not schedule a club outing.</p>{data.hikes.map(hike => <div className="community-desk-trail" key={hike.id}><div>{hike.name}<small>{hike.area} · {hike.active ? 'Listed' : 'Archived'}</small></div><button className="text-button" disabled={busy} onClick={async () => { if (await save({ verb: 'toggle_hike', hike_id: hike.id, active: !hike.active })) setNotice(hike.active ? 'Trail archived. Its photos and ratings remain saved.' : 'Trail is listed again.'); }}>{hike.active ? 'Archive' : 'List again'}</button></div>)}<form className="club-form" onSubmit={add}><label>Trail name<input name="name" required minLength={3} maxLength={100} disabled={busy}/></label><label>Park or area<input name="area" required minLength={3} maxLength={120} disabled={busy}/></label><label>Official trail information<input name="official_url" type="url" pattern="https://.*" required maxLength={500} placeholder="https://…" disabled={busy}/></label><button className="button" disabled={busy}>Add trail</button></form></details><h3>The club camera roll</h3><p className="fine">Up to 100 photos, with reported photos first. Hide a photo to stop member access while you review it. Owners can still remove their own photos.</p><div className="community-desk-list">{data.photos.length ? data.photos.map(photo => <article className="community-desk-photo" key={photo.id}><HikeImage path={photo.object_path} alt={photo.alt_text}/><div><h4>{photo.hike_name}</h4><small>By {photo.author_name} · {photo.status}</small><p>{photo.caption || photo.alt_text}</p>{photo.reports > 0 && <p>{photo.reports} {photo.reports === 1 ? 'concern' : 'concerns'}: {[...new Set(photo.reasons)].join(' · ')}</p>}<div className="community-desk-actions"><button className="text-button" disabled={busy} onClick={async () => { if (await save({ verb: photo.status === 'hidden' ? 'restore' : 'hide', id: photo.id })) setNotice(photo.status === 'hidden' ? 'Photo restored to the gallery.' : 'Photo hidden from members.'); }}>{photo.status === 'hidden' ? 'Restore photo' : 'Hide photo'}</button>{photo.reports > 0 && <button className="text-button" disabled={busy} onClick={async () => { if (await save({ verb: 'resolve', id: photo.id })) setNotice('Concerns marked reviewed.'); }}>Mark reviewed</button>}</div></div></article>) : <p className="desk-empty">Member hike photos will appear here.</p>}</div></>}</div>;
}
