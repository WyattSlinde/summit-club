'use client';

import { useEffect, useState, useRef, type FormEvent } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowUpRight, Check, Loader2 } from 'lucide-react';
import { basecampRequest, type BasecampState, type Member } from '@/lib/basecamp-client';
import { clubPhotos } from '@/lib/club-photos';
import { ClubPhoto, PhotoCredit } from '../club-photo';
import { SummitMark, SummitWordmark } from '../summit-brand';
import './registration.css';

export default function Registration({ signInHref, signOutHref, localPreview }: { signInHref: string; signOutHref: string; localPreview: boolean }) {
  const [state, setState] = useState<BasecampState | null>(null);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false), [error, setError] = useState(''), [saved, setSaved] = useState(false);
  const submitting = useRef(false), readVersion = useRef(0);
  async function load() {
    const version = ++readVersion.current; setLoading(true); setError('');
    try { const data = await basecampRequest<BasecampState>(); if (version === readVersion.current) setState(data); }
    catch (error) { if (version === readVersion.current) setError(error instanceof Error ? error.message : 'Could not load your registration.'); }
    finally { if (version === readVersion.current) setLoading(false); }
  }
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { const reads = readVersion; void load(); return () => { reads.current++; }; }, []);
  async function register(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; readVersion.current++; setLoading(false); setSaving(true); setError(''); setSaved(false);
    const form = new FormData(event.currentTarget);
    try {
      const result = await basecampRequest<{ saved: true; member: Member }>({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'join', name: form.get('name'), grade: form.get('grade'), interest: form.get('interest'), consent: form.get('consent') === 'on' }) });
      setState(current => current ? { ...current, member: result.member } : current);
      setEditing(false); setSaved(true);
      document.getElementById('registration-title')?.focus();
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not save your registration. Your input is still here.'); }
    finally { submitting.current = false; setSaving(false); }
  }
  const registered = !!state?.member && !editing;
  return <main className="registration-page">
    <header className="registration-header"><Link href="/#basecamp" className="registration-brand" aria-label="SUMMIT home"><SummitMark/><SummitWordmark/></Link><Link href="/#basecamp" className="registration-back"><ArrowLeft size={16}/> Back to the club</Link></header>
    <div className="registration-layout">
      <aside className="registration-landscape"><figure><div className="registration-photo"><ClubPhoto photo={clubPhotos.hike} sizes="(max-width: 760px) 0px, 45vw"/><div><span>EXPLORE. SERVE. LEAD.</span><h2>A little outside.<br/>A lot together.</h2><p>Your next adventure starts with the crew.</p></div></div><PhotoCredit photo={clubPhotos.hike}/></figure></aside>
      <section className="registration-panel" aria-labelledby="registration-title" aria-busy={loading || saving}>
        <span className={`registration-status ${registered ? 'is-registered' : ''}`}>{registered && <Check size={14}/>} {loading && !state ? 'CHECKING YOUR STATUS' : !state ? 'CONNECTION UNAVAILABLE' : registered ? 'REGISTERED' : editing ? 'UPDATE REGISTRATION' : 'NOT REGISTERED YET'}</span>
        <h1 id="registration-title" tabIndex={-1}>{registered ? 'You’re part of the crew.' : editing ? 'Make it yours.' : 'Join SUMMIT.'}</h1>
        {loading && !state ? <p className="registration-loading" role="status"><Loader2 className="spin" size={18}/> Connecting to basecamp…</p>
          : !state ? <button className="registration-primary" disabled={loading} onClick={load}>Try again</button>
          : !state.signedIn ? <><p className="registration-intro">The outdoor adventure, service, and leadership club for every Cathedral Catholic student. No experience needed.</p><ol className="registration-steps"><li><span>01</span>Sign in to keep your registration private.</li><li><span>02</span>Add your name, grade, and interests.</li><li><span>03</span>Help choose where we go next.</li></ol><a className="registration-primary" href={signInHref} target="_top">Continue to registration<ArrowUpRight size={18}/></a><p className="registration-fine">You’ll sign in with ChatGPT, then return here to finish. Signing in alone doesn’t register you.</p></>
          : registered && state.member ? <><p className="registration-intro">Your interest is saved with club leadership. Help choose our next outing while the crew confirms the plan.</p><dl className="registration-record"><div><dt>Name</dt><dd>{state.member.name}</dd></div><div><dt>Grade</dt><dd>{state.member.grade}</dd></div><div><dt>Here for</dt><dd>{state.member.interest}</dd></div></dl><Link className="registration-primary" href="/#expeditions">Choose our next outing<ArrowUpRight size={18}/></Link><button className="registration-secondary" onClick={() => { setEditing(true); setSaved(false); setError(''); }}>Edit my registration</button><p className="registration-fine">Each confirmed outing has its own RSVP and any required permissions. Your registration is not an outing RSVP.</p></>
          : <form onSubmit={register} className="registration-form"><p className="registration-intro">Tell the crew a little about you. Your details are visible only to you and approved club leaders.</p><label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={70} defaultValue={state.member?.name ?? ''} placeholder="First and last name" disabled={saving}/></label><div className="registration-fields"><label>Grade<select name="grade" required defaultValue={state.member?.grade ?? ''} disabled={saving}><option value="" disabled>Choose grade</option>{['9','10','11','12'].map(grade => <option key={grade} value={grade}>Grade {grade}</option>)}</select></label><label>I’m here for<select name="interest" required defaultValue={state.member?.interest ?? 'All of it'} disabled={saving}>{['Explore','Serve','Lead','All of it'].map(interest => <option key={interest}>{interest}</option>)}</select></label></div><label className="registration-consent"><input type="checkbox" name="consent" required disabled={saving}/><span>I’m a Cathedral Catholic student and agree to save my name, grade, and interests for club registration.</span></label><button className="registration-primary" disabled={saving}>{saving ? <><Loader2 size={18} className="spin"/> Saving…</> : editing ? 'Save changes' : 'Register with SUMMIT'}</button>{editing && <button type="button" className="registration-secondary" disabled={saving} onClick={() => { setEditing(false); setError(''); }}>Cancel changes</button>}<p className="registration-fine">Registering your interest doesn’t sign you up for an outing. Leaders confirm each plan separately.</p></form>}
        {error && <p className="registration-error" role="alert">{error}</p>}
        {saved && <p className="registration-saved" role="status"><Check size={16}/> Registration saved. Club leadership can see your interests.</p>}
        {state?.signedIn && <a className="registration-signout" href={signOutHref} target="_top">Sign out or switch accounts</a>}
        {localPreview && <p className="registration-local">Local preview · Sign-in uses one shared demo account and a local database. Real student accounts become available on the hosted site.</p>}
      </section>
    </div>
    <footer>SUMMIT · Cathedral Catholic High School<span>Founder &amp; President: Tobias Kell</span></footer>
  </main>;
}
