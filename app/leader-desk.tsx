'use client';

import { useEffect, useState, useRef, useCallback, useId, type FormEvent } from 'react';
import { Download, RefreshCw, Search, Users, Lightbulb, CalendarDays, Mountain, ShieldCheck, ArrowUpRight, LockKeyhole } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { adventures } from '@/lib/adventures';
import { rosterCSV, type LeaderData } from '@/lib/leader-data';
import './leader-desk.css';
import { sitePath } from '@/lib/site-path';
import CommunityDesk from './community-desk';
import { cloudConfigured } from '@/lib/cloud-client';
import { leaderRequest } from '@/lib/leader-client';

const dateLabel = (date: string) => new Date(date).toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});
const sections = ['members', 'ideas', 'events', 'community', 'reports'] as const;
type Section = typeof sections[number];
const choiceName = (id: string) => adventures.find(item => item.id === id)?.name ?? id;

export default function LeaderDesk({ open, onOpenChange, onChanged, inline = false }: {
  open: boolean; onOpenChange?: (value: boolean) => void; onChanged: () => void; inline?: boolean;
}) {
  const titleId = useId(), descriptionId = useId();
  const [section, setSection] = useState<Section>('members');
  const [cancelId, setCancelId] = useState('');
  const saving = useRef(false);
  const cancelButtons = useRef(new Map<string, HTMLButtonElement>()), keepEvent = useRef<HTMLButtonElement>(null), noticeElement = useRef<HTMLParagraphElement>(null), previousCancel = useRef('');
  useEffect(() => {
    if (cancelId) keepEvent.current?.focus();
    else if (previousCancel.current) (cancelButtons.current.get(previousCancel.current) || noticeElement.current)?.focus();
    previousCancel.current = cancelId;
  }, [cancelId]);
  useEffect(() => {
    if (!inline) return;
    const sync = () => { const value = window.location.hash.slice(1); setSection(sections.includes(value as Section) ? value as Section : 'members'); };
    sync(); window.addEventListener('hashchange', sync); window.addEventListener('popstate', sync);
    return () => { window.removeEventListener('hashchange', sync); window.removeEventListener('popstate', sync); };
  }, [inline]);
  function chooseSection(value: string) {
    if (!sections.includes(value as Section)) return;
    setSection(value as Section);
    if (inline && window.location.hash !== `#${value}`) window.history.pushState(null, '', `#${value}`);
  }
  const [data, setData] = useState<LeaderData | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(false);
  const [updatedAt, setUpdatedAt] = useState(0);
  const [search, setSearch] = useState(''), [interest, setInterest] = useState('All interests');
  const requestId = useRef(''), activeRequest = useRef<AbortController | null>(null);
  const load = useCallback(async () => {
    activeRequest.current?.abort();
    const controller = new AbortController(); activeRequest.current = controller;
    setLoading(true); setError('');
    try {
      const result = await leaderRequest(undefined, controller.signal);
      if (!controller.signal.aborted) { setData(result); setUpdatedAt(Date.now()); }
    } catch (error) {
      if (!controller.signal.aborted) { setData(null); setError(error instanceof Error ? error.message : 'Could not connect. Please try again.'); }
    } finally { if (!controller.signal.aborted) setLoading(false); }
  }, []);
  useEffect(() => {
    if (!open) return;
    requestId.current = crypto.randomUUID();
    const frame = requestAnimationFrame(() => { void load(); });
    return () => { cancelAnimationFrame(frame); activeRequest.current?.abort(); };
  }, [open, load]);

  async function save(body: Record<string, unknown>) {
    if (saving.current) return false;
    saving.current = true; activeRequest.current?.abort();
    setBusy(true); setLoading(false); setError(''); setNotice('');
    try {
      const result = await leaderRequest(body);
      setData(result); setUpdatedAt(Date.now()); onChanged(); return true;
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); return false; }
    finally { saving.current = false; setBusy(false); }
  }
  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget, fields = new FormData(form);
    const date = new Date(String(fields.get('date')));
    if (!Number.isFinite(date.getTime())) { setError('Choose a date.'); return; }
    if (await save({ action: 'event', id: requestId.current, title: fields.get('title'), location: fields.get('location'), details: fields.get('details'), startsAt: date.toISOString() })) {
      form.reset(); requestId.current = crypto.randomUUID(); setNotice('Event published. Members can now RSVP.');
    }
  }
  const members = (data?.members ?? []).filter(member =>
    (interest === 'All interests' || member.interest === interest) &&
    `${member.name} ${member.grade}`.toLowerCase().includes(search.trim().toLowerCase()));
  function exportRoster() {
    const url = URL.createObjectURL(new Blob(['\uFEFF' + rosterCSV(members, choiceName)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'summit-registration-roster.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  const activeSection = (section === 'community' && !cloudConfigured) || (section === 'reports' && !data?.reports) ? 'members' : section;
  const content = <>
      <header className="desk-hero">
        {/* Static Pages uses an already optimized 800px WebP; no image server is required. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="desk-landscape" src={sitePath('/photos/mountain-sunset-800.webp')} alt="" width={800} height={534} decoding="async"/>
        <div className="desk-heading"><div><p className="desk-kicker"><Mountain size={16} aria-hidden="true"/> SUMMIT / CLUB LEADERSHIP</p>
          {inline ? <h1 className="desk-title" id={titleId}>Make the next<br/>adventure happen.</h1> : <DialogTitle className="desk-title">Your club, at a glance.</DialogTitle>}
          {inline ? <p className="desk-description" id={descriptionId}>Your people. Their ideas. Everything you need to bring the crew together.</p> : <DialogDescription className="desk-description">Your people. Their ideas. Everything you need to bring the crew together.</DialogDescription>}
          <p className="desk-private"><LockKeyhole size={13} aria-hidden="true"/> Only club leaders can see this desk.</p>
        </div><button className="desk-refresh" aria-label="Refresh leadership data" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={18} className={loading ? 'spin' : ''}/><span>Refresh</span></button></div>
      </header>
      <div className="desk-body">
      {error && <p role="alert" className="error">{error} <button onClick={() => void load()} disabled={loading}>Retry</button></p>}
      {loading && <p role="status" className="fine">Updating the leadership desk…</p>}
      {notice && <p ref={noticeElement} tabIndex={-1} role="status" className="desk-notice">{notice}</p>}
      {data && <>
        <div className="desk-summary" aria-label="Club totals">
          <button onClick={() => chooseSection('members')} aria-label="View registered members"><Users size={19}/><strong>{data.memberCount}</strong><span>Members</span><ArrowUpRight size={15}/></button>
          <button onClick={() => chooseSection('ideas')} aria-label="View student ideas"><Lightbulb size={19}/><strong>{data.totalIdeas}</strong><span>Ideas</span><ArrowUpRight size={15}/></button>
          <button onClick={() => chooseSection('events')} aria-label="View upcoming events"><CalendarDays size={19}/><strong>{data.events.filter(event => event.status === 'published' && Date.parse(event.starts_at) > updatedAt).length}</strong><span>Upcoming</span><ArrowUpRight size={15}/></button>
        </div>
        <Tabs value={activeSection} onValueChange={chooseSection} className="desk-workspace"><TabsList className="desk-tabs" aria-label="Leadership sections">
          <TabsTrigger value="members"><Users size={17}/><span>Members</span></TabsTrigger>
          <TabsTrigger value="ideas"><Lightbulb size={17}/><span>Ideas & votes</span></TabsTrigger>
          <TabsTrigger value="events"><CalendarDays size={17}/><span>Events & RSVPs</span></TabsTrigger>
          {cloudConfigured && <TabsTrigger value="community"><Mountain size={17}/><span>Hikes & photos</span></TabsTrigger>}
          {data.reports && <TabsTrigger value="reports"><ShieldCheck size={17}/><span>Concerns{data.reports.length > 0 ? ` (${data.reports.length})` : ''}</span></TabsTrigger>}
        </TabsList>
          <TabsContent value="members"><div className="desk-section-heading"><div><p className="desk-label">THE CREW</p><h2>People make the club.</h2></div><p>Find a member, see their interests, or take the roster with you.</p></div>
            <div className="desk-filters"><label className="desk-search"><Search size={17}/><input aria-label="Search members by name or grade" placeholder="Search name or grade" value={search} onChange={event => setSearch(event.target.value)}/></label>
              <select aria-label="Filter members by interest" value={interest} onChange={event => setInterest(event.target.value)}>{['All interests', 'Explore', 'Serve', 'Lead', 'All of it'].map(value => <option key={value}>{value}</option>)}</select></div>
            <div className="desk-roster-meta"><span>{members.length} shown · {data.memberCount} registered</span><button className="text-button" onClick={exportRoster} disabled={!members.length}><Download size={15}/> Export shown members</button></div>
            {data.memberCount > data.members.length && <p className="fine">Showing the latest {data.members.length} registrations. Older registrations are still saved in the database.</p>}
            <div className="desk-roster">{members.length ? members.map((member, index) => <article key={`${member.created_at}-${index}`}>
              <div className="desk-person"><span className="desk-avatar" aria-hidden="true">{member.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('')}</span><div><strong>{member.name}</strong><span>Grade {member.grade} · Joined {new Date(member.created_at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' })}</span></div></div>
              <span className="desk-interest">{member.interest}</span>
              <details className="desk-member-details"><summary>Signup details</summary>{member.contact_email && <p><a href={`mailto:${member.contact_email}`}>{member.contact_email}</a></p>}
              {member.note && <p>{member.note}</p>}
              {member.notification_status && <p>Email to Tobias: {member.notification_status === 'sent' ? 'Sent to mail provider' : member.notification_status === 'needs_review' ? 'Needs delivery review' : 'Queued for sending'}</p>}
              {member.choices && <p>Voted for {(member.choices ?? '').split(',').map(choiceName).join(' · ')}</p>}</details>
            </article>) : <p className="desk-empty">{data.memberCount ? 'No members match those filters.' : 'Registrations will appear here as students join.'}</p>}</div>
          </TabsContent>
          <TabsContent value="ideas"><div className="desk-section-heading"><div><p className="desk-label">LISTEN, THEN PLAN</p><h2>What’s on their minds?</h2></div><p>Outing votes and suggestions from your members.</p></div>
            <div className="desk-votes"><h3>What students want to do</h3>{adventures.map(adventure => {
              const count = data.votes.find(vote => vote.adventure_id === adventure.id)?.count ?? 0;
              const maximum = Math.max(1, ...data.votes.map(vote => vote.count));
              return <div className="desk-vote" key={adventure.id}><span>{adventure.name}</span><strong>{count} {count === 1 ? 'vote' : 'votes'}</strong><div><i style={{ width: `${count / maximum * 100}%` }}/></div></div>;
            })}<p className="fine">Students can vote for more than one outing.</p></div>
            <div className="desk-interest-summary">{data.interests.map(item => <span key={item.interest}>{item.interest}<strong>{item.count}</strong></span>)}</div>
            <div className="desk-list"><h3>Ideas from the crew</h3>{data.totalIdeas > data.proposals.length && <p className="fine">Latest {data.proposals.length} of {data.totalIdeas} ideas.</p>}{data.proposals.length ? data.proposals.map(proposal => <article key={proposal.id}><span className="eyebrow">{proposal.category} · {proposal.name || 'Student idea'}</span><h4>{proposal.title}</h4><p>{proposal.description}</p><small>{dateLabel(proposal.created_at)} Pacific</small></article>) : <p className="desk-empty">Student suggestions will show up here.</p>}</div>
          </TabsContent>
          <TabsContent value="events"><div className="desk-section-heading"><div><p className="desk-label">PUT IT ON THE CALENDAR</p><h2>Make it a plan.</h2></div><p>Publish confirmed details. See who’s coming.</p></div>
            <details className="desk-create"><summary>Plan a new event</summary><form className="club-form" onSubmit={create}><fieldset disabled={busy}>
              <label>Event name<input name="title" required minLength={4} maxLength={100} placeholder="Give this outing a name"/></label>
              <div className="form-row"><label>Date & time (your local time)<input name="date" type="datetime-local" required/></label><label>Meeting location<input name="location" required minLength={3} maxLength={150}/></label></div>
              <label>What members need to know<textarea name="details" required minLength={10} maxLength={1500} rows={3} placeholder="The plan, permissions, accessibility, and what to bring"/></label>
              <button className="button" disabled={busy}>{busy ? 'Saving…' : 'Publish event'}</button></fieldset></form></details>
            <div className="desk-events">{data.events.length ? data.events.map(event => <article key={event.id}><span className="eyebrow">{event.status} · {event.count} RSVPs</span><h3>{event.title}</h3><p>{dateLabel(event.starts_at)} Pacific · {event.location}</p><p>{event.details}</p>
              <details className="desk-attendees"><summary>View attendees ({event.count})</summary>{data.attendees.filter(attendee => attendee.event_id === event.id).map((attendee, index) => <p key={index}>{attendee.name} · Grade {attendee.grade}</p>)}{!event.count && <p>No RSVPs yet.</p>}</details>
              {event.status === 'published' && (cancelId === event.id ? <div className="desk-cancel" role="group" aria-label={`Cancel ${event.title}`}><p>Cancel this event? Members won’t be able to RSVP.</p><div><button ref={keepEvent} className="text-button" disabled={busy} onClick={() => setCancelId('')}>Keep event</button><button className="desk-danger" disabled={busy} onClick={async () => { if (await save({ action: 'cancel', id: event.id })) { setCancelId(''); setNotice('Event cancelled. It is no longer accepting RSVPs.'); } }}>Confirm cancellation</button></div></div> : <button ref={node => { if (node) cancelButtons.current.set(event.id, node); else cancelButtons.current.delete(event.id); }} className="text-button" disabled={busy} onClick={() => setCancelId(event.id)}>Cancel event</button>)}
            </article>) : <p className="desk-empty">Publish the first meeting when its date and location are confirmed.</p>}</div>
          </TabsContent>
          {data.reports && <TabsContent value="reports"><div className="desk-list"><h3>Member concerns</h3><p className="fine">Follow up privately through the school’s usual support process.</p>{data.reports.length ? data.reports.map(report => <article key={report.id}><span className="eyebrow">{report.reason} · {report.reported_name}</span><p>{report.details || 'No additional details.'}</p><small>{dateLabel(report.created_at)} Pacific</small><button className="text-button" disabled={busy} onClick={async () => { if (await save({ action: 'resolve', id: report.id })) setNotice('Concern marked reviewed.'); }}>Mark reviewed</button></article>) : <p className="desk-empty">No open concerns.</p>}</div></TabsContent>}
          {cloudConfigured && <TabsContent value="community"><CommunityDesk/></TabsContent>}
        </Tabs>
      </>}
      </div>
  </>;
  if (inline) return <section className="leader-desk leader-desk-inline" aria-labelledby={titleId} aria-describedby={descriptionId}>{content}</section>;
  return <Dialog open={open} onOpenChange={value => { if (!value) { setData(null); setNotice(''); } onOpenChange?.(value); }}><DialogContent className="leader-desk leader-dialog">{content}</DialogContent></Dialog>;
}
