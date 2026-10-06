'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import type { User } from '@supabase/supabase-js';
import { ArrowLeft, ArrowUpRight, Camera, Check, Copy, Leaf, Loader2, LockKeyhole, Plus, RefreshCw, Shield, UserRound, UserRoundPlus, Users } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { cloudConfigured, cloudClient, clubRequest, announceMemberChange } from '@/lib/cloud-client';
import { type Member } from '@/lib/basecamp-client';
import { type Profile, type Connections, type Connection, profileInterests, initials, validFriendTag, normalizeFriendTag, accountReturn } from '@/lib/member-profile';
import { clearMyHikePhotos } from '@/lib/hike-photo';
import { prepareProfilePhoto } from '@/lib/profile-photo';
import { sitePath } from '@/lib/site-path';
import { SummitMark, SummitWordmark } from '../summit-brand';
import MemberAuth, { MemberSignOut } from '../member-auth';
import './profile.css';

function Avatar({ path, name, version, preview, large = false }: { path: string | null; name: string; version?: string; preview?: string; large?: boolean }) {
  const [image, setImage] = useState({ url: '', key: '' });
  const imageKey = `${path}:${version}`;
  const url = image.key === imageKey ? image.url : '';
  useEffect(() => {
    let cancelled = false, objectUrl = '';
    if (path && cloudConfigured) void cloudClient().storage.from('member-photos').download(path).then(({ data, error }) => {
      if (!cancelled && data && !error) { objectUrl = URL.createObjectURL(data); setImage({ url: objectUrl, key: imageKey }); }
    }).catch(() => undefined);
    return () => { cancelled = true; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [path, imageKey]);
  return <div className={`member-avatar ${large ? 'is-large' : ''}`}>{preview || url ? <img src={preview || url} alt={`${name}'s profile`} width={large ? 136 : 52} height={large ? 136 : 52}/> : <span aria-label={`${name}, no profile photo`}>{initials(name)}</span>}</div>;
}
const emptyConnections: Connections = { connections: [], blocked: [] };
export default function MemberProfile() {
  const [user, setUser] = useState<User | null>(null), [member, setMember] = useState<Member | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null), [draft, setDraft] = useState<Profile | null>(null);
  const [crew, setCrew] = useState<Connections>(emptyConnections);
  const [tab, setTab] = useState<'profile' | 'friends' | 'settings'>('profile');
  const [loading, setLoading] = useState(cloudConfigured), [busy, setBusy] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [tag, setTag] = useState(''), [copied, setCopied] = useState(false), [returnTo, setReturnTo] = useState<string | null>(null);
  const [photo, setPhoto] = useState<Blob | null>(null), [photoPreview, setPhotoPreview] = useState('');
  const [report, setReport] = useState<{ user_id: string; display_name: string } | null>(null), [recovery, setRecovery] = useState(false);
  const [deleteText, setDeleteText] = useState('');
  const version = useRef(0), pending = useRef(false), fileInput = useRef<HTMLInputElement>(null), draftChanged = useRef(false), accountId = useRef<string | null>(null);
  const reload = useCallback(async (keepDraft = false) => {
    if (!cloudConfigured) return;
    const current = ++version.current; setLoading(true); setError('');
    try {
      const { data, error: authError } = await cloudClient().auth.getUser();
      if (current !== version.current) return;
      if (authError && authError.name !== 'AuthSessionMissingError') throw new Error('Could not check your account. Try again.');
      if (!data.user) { setUser(null); setProfile(null); setDraft(null); setMember(null); setCrew(emptyConnections); return; }
      const saved = await clubRequest<{ profile: Profile | null; member: Member | null }>('profile');
      const connections = saved.profile ? await clubRequest<Connections>('connections') : emptyConnections;
      if (current !== version.current) return;
      setUser(data.user); accountId.current = data.user.id;
      setProfile(saved.profile); setMember(saved.member); setCrew(connections);
      if (!keepDraft || !draftChanged.current) { setDraft(saved.profile); draftChanged.current = false; }
    } catch (e) { if (current === version.current) setError(e instanceof Error ? e.message : 'Could not load your profile.'); }
    finally { if (current === version.current) setLoading(false); }
  }, []);
  // Hydrate browser-only routing and subscribe to the external auth session.
  useEffect(() => {
    const reads = version;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setReturnTo(accountReturn(location.search)); setRecovery(new URLSearchParams(location.search).get('recovery') === '1');
    void reload();
    if (!cloudConfigured) return;
    let timer = 0;
    const { data } = cloudClient().auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && session?.user.id !== accountId.current)) {
        accountId.current = session?.user.id || null;
        setUser(null); setProfile(null); setDraft(null); setMember(null); setCrew(emptyConnections); draftChanged.current = false;
        // Never await another auth operation inside the auth callback.
        window.clearTimeout(timer); timer = window.setTimeout(() => { setPhoto(null); setPhotoPreview(''); void reload(); }, 0);
      }
    });
    return () => { reads.current++; window.clearTimeout(timer); data.subscription.unsubscribe(); };
  }, [reload]);
  useEffect(() => {
    if (!user || !profile) return;
    const refresh = () => { if (!pending.current && document.visibilityState === 'visible') void reload(true); };
    const timer = window.setInterval(refresh, 30000); window.addEventListener('focus', refresh);
    return () => { clearInterval(timer); window.removeEventListener('focus', refresh); };
  }, [user, profile, reload]);
  // Object URLs are external resources; release every replaced preview.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!photo) { setPhotoPreview(''); return; }
    const url = URL.createObjectURL(photo); setPhotoPreview(url); return () => URL.revokeObjectURL(url);
  }, [photo]);
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => { if (draftChanged.current || photo) e.preventDefault(); };
    window.addEventListener('beforeunload', warn); return () => window.removeEventListener('beforeunload', warn);
  }, [photo]);
  async function work(key: string, task: () => Promise<void>) {
    if (pending.current) return; pending.current = true; setBusy(key); setError(''); setNotice(''); version.current++; setLoading(false);
    try { await task(); announceMemberChange(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save. Please try again.'); }
    finally { pending.current = false; setBusy(''); }
  }
  function edit(patch: Partial<Profile>) { setDraft(current => current ? { ...current, ...patch } : current); draftChanged.current = true; }
  async function saveProfile(event: FormEvent) {
    event.preventDefault(); if (!draft) return;
    await work('profile', async () => {
      const saved = await clubRequest<Profile>('save_profile', { display_name: draft.display_name, bio: draft.bio, wants: draft.wants, interests: draft.interests, visibility: draft.visibility, accepting_requests: draft.accepting_requests });
      setProfile(saved); setDraft(saved); draftChanged.current = false; setNotice('Profile saved. Your sharing settings are up to date.');
    });
  }
  async function selectPhoto(file?: File) {
    if (!file) return;
    await work('prepare-photo', async () => { setPhoto(await prepareProfilePhoto(file)); });
    if (fileInput.current) fileInput.current.value = '';
  }
  async function uploadPhoto() {
    if (!photo || !profile) return;
    await work('photo', async () => {
      const { error } = await cloudClient().storage.from('member-photos').upload(`${profile.user_id}/avatar.jpg`, photo, { contentType: 'image/jpeg', upsert: true, cacheControl: '0' });
      if (error) throw new Error('Your photo could not be saved. Check your connection and try again.');
      const saved = await clubRequest<Profile>('photo');
      setProfile(saved); setDraft(current => current ? { ...current, photo_path: saved.photo_path, updated_at: saved.updated_at } : saved); setPhoto(null); setNotice('Photo saved.');
    });
  }
  async function removePhoto() {
    if (!profile) return;
    await work('remove-photo', async () => {
      const { error } = await cloudClient().storage.from('member-photos').remove([`${profile.user_id}/avatar.jpg`]);
      if (error) throw new Error('Could not remove your photo. Please try again.');
      const saved = await clubRequest<Profile>('photo', { remove: true });
      setProfile(saved); setDraft(current => current ? { ...current, photo_path: null, updated_at: saved.updated_at } : saved); setPhoto(null); setNotice('Photo removed.');
    });
  }
  async function friendAction(verb: string, other: string, name: string) {
    await work(other, async () => {
      await clubRequest('friend', { verb, user_id: other });
      setCrew(await clubRequest<Connections>('connections'));
      setNotice(verb === 'accept' ? `You and ${name} are now friends.` : verb === 'block' ? `${name} is blocked. Your connection has been removed.` : verb === 'unblock' ? `${name} is unblocked. A new request is needed to reconnect.` : 'Connection removed.');
    });
  }
  async function sendRequest(event: FormEvent) {
    event.preventDefault();
    if (!validFriendTag(tag)) { setError('Use the full friend tag, like SUM-1A2B3C4D5E.'); return; }
    await work('friend', async () => {
      const result = await clubRequest<{ status: string }>('friend', { verb: 'send', tag: normalizeFriendTag(tag) });
      setCrew(await clubRequest<Connections>('connections')); setTag('');
      setNotice(result.status === 'friends' ? 'You’re already friends.' : result.status === 'incoming' ? 'They already sent you a request. Accept it below to connect.' : 'Request sent. You’ll connect when your friend accepts.');
    });
  }
  const friends = crew.connections.filter(c => c.status === 'accepted');
  const incoming = crew.connections.filter(c => c.status === 'pending' && !c.outgoing);
  const outgoing = crew.connections.filter(c => c.status === 'pending' && c.outgoing);
  async function copyTag() {
    if (!profile) return;
    try { await navigator.clipboard.writeText(profile.friend_tag); setCopied(true); window.setTimeout(() => setCopied(false), 2500); }
    catch { setError('Select your friend tag and copy it manually.'); }
  }
  const photoControls = <div className="member-photo-controls"><input ref={fileInput} className="member-file" type="file" accept="image/jpeg,image/png,image/webp" aria-label="Choose a profile photo" onChange={e => void selectPhoto(e.target.files?.[0])} disabled={!!busy}/><button type="button" className="member-secondary" onClick={() => fileInput.current?.click()} disabled={!!busy}><Camera size={16}/> {profile?.photo_path ? 'Change photo' : 'Add a photo'}</button>{profile?.photo_path && !photo && <button type="button" className="member-text" onClick={() => void removePhoto()} disabled={!!busy}>Remove photo</button>}<small>JPG, PNG, or WebP · Up to 10 MB<br/>We crop it square and remove location metadata.</small>{photo && <div className="member-photo-confirm"><p>Preview your crop, then save it.</p><button className="member-primary" disabled={!!busy} onClick={() => void uploadPhoto()}>{busy === 'photo' ? 'Saving…' : 'Save photo'}</button><button className="member-text" disabled={!!busy} onClick={() => setPhoto(null)}>Cancel</button></div>}</div>;
  function connectionCard(connection: Connection) {
    return <article className="member-friend" key={connection.id}><div className="member-friend-heading"><Avatar path={connection.photo_path} name={connection.display_name} version={connection.updated_at}/><div><h3>{connection.display_name}</h3><span>{connection.status === 'accepted' ? 'In your crew' : connection.outgoing ? 'Waiting for a reply' : 'Wants to join your crew'}</span></div></div>
      {connection.status === 'accepted' && (connection.shared ? <><p>{connection.bio || 'The next adventure is still being written.'}</p>{connection.wants && <div className="friend-wants"><span>NEXT ON MY LIST</span><p>{connection.wants}</p></div>}<div className="member-interest-tags">{connection.interests?.map(item => <span key={item}>{item}</span>)}</div></> : <p className="member-fine"><LockKeyhole size={13}/> This friend keeps their photo and profile private.</p>)}
      <div className="member-friend-actions">{connection.status === 'pending' && !connection.outgoing && <button className="member-primary" disabled={!!busy} onClick={() => void friendAction('accept', connection.user_id, connection.display_name)}><Check size={15}/> Accept</button>}<button className="member-text" disabled={!!busy} onClick={() => void friendAction('remove', connection.user_id, connection.display_name)}>{connection.status === 'accepted' ? 'Remove friend' : connection.outgoing ? 'Cancel request' : 'Decline'}</button><details className="friend-options"><summary aria-label={`More options for ${connection.display_name}`}>More</summary><div><button disabled={!!busy} onClick={() => void friendAction('block', connection.user_id, connection.display_name)}>Block member</button><button disabled={!!busy} onClick={() => setReport(connection)}>Report profile</button></div></details></div></article>;
  }
  return <main className="member-page"><header className="member-header"><Link href="/#basecamp" className="member-brand" aria-label="SUMMIT home"><SummitMark motion="entrance"/><SummitWordmark/></Link><nav aria-label="Member navigation"><Link href="/#expeditions">Outings <ArrowUpRight size={14}/></Link><Link href="/#basecamp"><ArrowLeft size={14}/> The club</Link>{user && <MemberSignOut onDone={() => void reload()}/>}</nav></header>
    <div className="member-cover" style={{ backgroundImage: `linear-gradient(0deg,rgba(16,35,29,.8),rgba(16,35,29,.05)),url('${sitePath('/photos/mountain-sunset-1600.webp')}')` }}><div><span>SUMMIT / YOUR CORNER OF THE OUTSIDE</span><h1>{user && profile ? 'Good company.\nGreat places.' : 'It’s better\nwith your people.'}</h1><p>Your next adventure starts with the crew.</p></div><Leaf size={30}/></div>
    <div className="member-shell">{error && <div className="member-error" role="alert">{error}<button className="member-text" onClick={() => void reload(true)} disabled={!!busy || loading}>Retry connection</button></div>}{notice && <p className="member-notice" role="status"><Check size={16}/>{notice}</p>}
      {!cloudConfigured ? <section className="member-onboarding"><div><span className="member-kicker">YOUR PROFILE. YOUR PEOPLE.</span><h2>A place in the crew.</h2><p>A photo, a few things you love, and what you want to do next. Connect with classmates through your own friend tag.</p><p className="member-fine">Online accounts are being connected. No profile information is collected yet.</p><Link className="member-primary" href="/#basecamp">Explore the club <ArrowUpRight size={17}/></Link></div><div className="member-welcome-art" aria-hidden="true"><SummitMark/><span>EXPLORE. SERVE. LEAD.</span><div><UserRound/><Plus/><Users/></div></div></section>
        : loading && !user ? <div className="member-empty" role="status"><Loader2 className="spin"/> Opening your basecamp…</div>
        : !user || recovery ? <section className="member-onboarding"><div><span className="member-kicker">MAKE YOURSELF AT HOME</span><h2>A little about you.<br/>A lot to look forward to.</h2><ul><li><Camera size={19}/> Add a photo and your outdoor interests.</li><li><UserRoundPlus size={19}/> Connect with friends using their tags.</li><li><Shield size={19}/> Choose what you share. Change it anytime.</li></ul></div><MemberAuth onSignedIn={() => { setRecovery(false); void reload(); }}/></section>
        : !profile || !draft ? <section className="member-empty"><Leaf/><h2>First, join the club.</h2><p>Register your name, grade, and interests. Then make your profile and connect with the crew.</p><Link className="member-primary" href="/register/">Finish registration <ArrowUpRight size={17}/></Link></section>
        : <><div className="member-identity"><Avatar path={profile.photo_path} name={profile.display_name} version={profile.updated_at} preview={photoPreview} large/><div><span className="member-kicker">YOUR SUMMIT PROFILE</span><h2>{profile.display_name}</h2><p>{member?.interest} · Cathedral Catholic</p></div><div className="member-tag"><span>YOUR FRIEND TAG</span><button onClick={() => void copyTag()} title="Copy your friend tag"><code>{profile.friend_tag}</code>{copied ? <Check size={15}/> : <Copy size={15}/>}</button><small>{copied ? 'Copied. Share it with a friend.' : 'Share it with people you know.'}</small></div></div>
          {returnTo && <Link href={returnTo} className="member-return">Continue to your {returnTo.includes('outing=') ? 'outing vote' : 'idea'} <ArrowUpRight size={16}/></Link>}
          <div className="member-tabs" aria-label="Profile sections"><button aria-pressed={tab === 'profile'} onClick={() => setTab('profile')}><UserRound size={17}/> My profile</button><button aria-pressed={tab === 'friends'} onClick={() => setTab('friends')}><Users size={17}/> My crew <span>{friends.length}</span>{incoming.length > 0 && <b aria-label={`${incoming.length} friend requests`}>{incoming.length}</b>}</button><button aria-pressed={tab === 'settings'} onClick={() => setTab('settings')}><Shield size={17}/> Privacy & account</button></div>
          {tab === 'profile' && <div className="member-profile-grid"><section className="member-panel"><div className="member-section-heading"><span className="member-kicker">01 / MAKE IT YOURS</span><h2>The person behind the profile.</h2><p>Keep it simple. A little about you goes a long way.</p></div><div className="member-photo-editor"><Avatar path={profile.photo_path} name={profile.display_name} version={profile.updated_at} preview={photoPreview}/>{photoControls}</div><form className="member-form" onSubmit={saveProfile}><label>What should the crew call you?<input value={draft.display_name} minLength={2} maxLength={50} required onChange={e => edit({ display_name: e.target.value })} disabled={!!busy} autoComplete="nickname"/><small>Your display name appears on friend requests.</small></label><label>A little about you<textarea value={draft.bio} rows={3} maxLength={300} onChange={e => edit({ bio: e.target.value })} placeholder="New to hiking, always down for a beach cleanup, usually bringing snacks…" disabled={!!busy}/><small>{draft.bio.length}/300</small></label><fieldset><legend>What gets you outside?</legend><div className="member-interest-picker">{profileInterests.map(interest => <label key={interest}><input type="checkbox" checked={draft.interests.includes(interest)} disabled={!!busy || (!draft.interests.includes(interest) && draft.interests.length >= 6)} onChange={e => edit({ interests: e.target.checked ? [...draft.interests, interest] : draft.interests.filter(i => i !== interest) })}/><span>{interest}</span></label>)}</div><small>Choose up to six.</small></fieldset><label>Next on my list<textarea value={draft.wants} rows={3} maxLength={400} onChange={e => edit({ wants: e.target.value })} placeholder="I want to try a sunrise hike and help plan a trail cleanup." disabled={!!busy}/><small>{draft.wants.length}/400 · Share ideas for adventures, not your live location.</small></label><button className="member-primary" disabled={!!busy}>{busy === 'profile' ? <Loader2 className="spin" size={17}/> : <Check size={17}/>} {busy === 'profile' ? 'Saving…' : 'Save my profile'}</button></form></section>
            <aside className="member-side"><div className="member-field-note"><Leaf size={27}/><span className="member-kicker">THERE’S ROOM FOR YOU HERE</span><h3>You don’t have to be outdoorsy.<br/>Just curious.</h3><p>Pick a trail. Pitch an idea. Bring a friend. Every great outing starts somewhere.</p><Link href="/#expeditions">Choose what’s next <ArrowUpRight size={16}/></Link></div><div className="member-sharing-note"><LockKeyhole size={19}/><h3>{profile.visibility === 'friends' ? 'Shared with your friends.' : 'Just for you, for now.'}</h3><p>{profile.visibility === 'friends' ? 'Accepted friends can see your photo, bio, interests, and next adventure.' : 'Your photo, bio, interests, and next adventure stay private until you choose to share.'}</p><button className="member-text" onClick={() => setTab('settings')}>Manage sharing <ArrowUpRight size={14}/></button></div><Link href="/register/" className="member-registration-link">Your club registration <ArrowUpRight size={15}/></Link></aside></div>}
          {tab === 'friends' && <section className="member-crew"><div className="member-section-heading"><span className="member-kicker">02 / GOOD COMPANY</span><h2>Build your crew.</h2><p>Ask a classmate for their tag. Send a request. Get outside together.</p></div><form className="member-add-friend" onSubmit={sendRequest}><label>Friend’s tag<input value={tag} onChange={e => setTag(e.target.value.toUpperCase())} maxLength={14} autoCapitalize="characters" autoCorrect="off" spellCheck={false} placeholder="SUM-1A2B3C4D5E" required disabled={!!busy}/></label><button className="member-primary" disabled={!!busy}><UserRoundPlus size={17}/> {busy === 'friend' ? 'Sending…' : 'Send request'}</button></form>{!profile.accepting_requests && <p className="member-fine">Your incoming requests are turned off. <button className="member-text" onClick={() => setTab('settings')}>Turn them on in privacy settings.</button></p>}{incoming.length > 0 && <div className="member-crew-group"><h3>Friend requests <span>{incoming.length}</span></h3><div className="member-friend-grid">{incoming.map(connectionCard)}</div></div>}<div className="member-crew-group"><h3>Your friends <span>{friends.length}</span></h3>{friends.length ? <div className="member-friend-grid">{friends.map(connectionCard)}</div> : <div className="member-empty"><Users size={30}/><h3>Every crew starts with one friend.</h3><p>Share your tag with someone you know, or enter theirs above.</p><button className="member-secondary" onClick={() => void copyTag()}><Copy size={15}/> Copy my tag</button></div>}</div>{outgoing.length > 0 && <div className="member-crew-group"><h3>Requests you sent <span>{outgoing.length}</span></h3><div className="member-friend-grid">{outgoing.map(connectionCard)}</div></div>}</section>}
          {tab === 'settings' && <section className="member-settings"><div className="member-section-heading"><span className="member-kicker">03 / YOUR CHOICE</span><h2>Share on your terms.</h2><p>No public member directory. Your email and club registration stay private.</p></div><form className="member-form" onSubmit={saveProfile}><fieldset className="member-privacy-options" disabled={!!busy}><legend>Who can see your full profile?</legend><label><input type="radio" name="visibility" value="private" checked={draft.visibility === 'private'} onChange={() => edit({ visibility: 'private' })}/><span><strong>Only me</strong><small>Your photo, bio, interests, and next adventure stay private.</small></span><LockKeyhole size={19}/></label><label><input type="radio" name="visibility" value="friends" checked={draft.visibility === 'friends'} onChange={() => edit({ visibility: 'friends' })}/><span><strong>My accepted friends</strong><small>Share your profile after you both agree to connect.</small></span><Users size={19}/></label></fieldset><label className="member-switch"><input type="checkbox" disabled={!!busy} checked={draft.accepting_requests} onChange={e => edit({ accepting_requests: e.target.checked })}/><span><strong>Let people with my tag send requests</strong><small>They see your display name. You choose who becomes a friend.</small></span></label><button className="member-primary" disabled={!!busy}><Check size={17}/> Save privacy settings</button><p className="member-fine">Your display name appears on requests and your friends’ lists even when your full profile is private. Approved leaders can view your registration, outing votes, RSVPs, and submitted ideas.</p></form><div className="member-settings-row"><div><h3>New tag, fresh start.</h3><p>Replace your friend tag if it’s been shared too widely. Existing friends stay connected.</p></div><button className="member-secondary" disabled={!!busy} onClick={() => void work('tag', async () => { const saved = await clubRequest<Profile>('rotate_tag'); setProfile(saved); setDraft(current => current ? { ...current, friend_tag: saved.friend_tag } : saved); setNotice('Your friend tag has changed. The old tag no longer works.'); })}><RefreshCw size={15}/> Change my tag</button></div><div className="member-settings-row"><div><h3>Blocked members</h3><p>Blocking removes the connection and stops new requests in either direction.</p>{crew.blocked.length ? crew.blocked.map(block => <div className="member-blocked" key={block.user_id}><span>{block.display_name}</span><button className="member-text" disabled={!!busy} onClick={() => void friendAction('unblock', block.user_id, block.display_name)}>Unblock</button></div>) : <small>No blocked members.</small>}</div></div><details className="member-delete"><summary>Delete my club profile</summary><p>This deletes your registration, profile, profile photo, hike photos, hike ratings, friends, votes, ideas, and RSVPs. Your sign-in account remains so you can register again later.</p><label>Type DELETE to confirm<input value={deleteText} onChange={e => setDeleteText(e.target.value)} autoComplete="off"/></label><button className="member-danger" disabled={deleteText !== 'DELETE' || !!busy} onClick={() => void work('delete', async () => { const { error } = await cloudClient().storage.from('member-photos').remove([`${profile.user_id}/avatar.jpg`]); if (error) throw new Error('Could not remove your photo. Try again before deleting your profile.'); await clearMyHikePhotos(); await clubRequest('delete_profile', { confirm: deleteText }); setPhoto(null); setDeleteText(''); await reload(); setNotice('Your club profile and registration have been deleted.'); })}>Delete my club profile</button></details></section>}
        </>}
    </div><footer className="member-footer"><span>SUMMIT · Cathedral Catholic High School</span><a href={sitePath('/photos/credits.txt')}>Photo credits</a><span>Explore. Serve. Lead.</span></footer>
    <Dialog open={!!report} onOpenChange={open => { if (!open && !busy) setReport(null); }}><DialogContent className="member-report-dialog"><DialogTitle>Report a concern</DialogTitle><DialogDescription>Send a concern about {report?.display_name} to approved club leaders. Only leadership can read your report.</DialogDescription><form className="member-form" onSubmit={event => { event.preventDefault(); const fields = new FormData(event.currentTarget); void work('report', async () => { await clubRequest('report', { user_id: report?.user_id, reason: fields.get('reason'), details: fields.get('details') }); setReport(null); setNotice('Report sent to club leadership. You can also block this member.'); }); }}><label>What’s going on?<select name="reason" required>{['Unwanted requests', 'Inappropriate profile', 'Something else'].map(reason => <option key={reason}>{reason}</option>)}</select></label><label>Anything else? <textarea name="details" maxLength={500} rows={3}/></label><button className="member-primary" disabled={!!busy}>{busy === 'report' ? 'Sending…' : 'Send report'}</button>{error && <p className="member-error" role="alert">{error}</p>}</form></DialogContent></Dialog>
  </main>;
}
