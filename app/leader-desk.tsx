'use client';

import { useEffect, useState, useRef, useCallback, type FormEvent } from 'react';
import { Download, RefreshCw, Search, Users, Lightbulb, CalendarDays } from 'lucide-react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { adventures } from '@/lib/adventures';
import { rosterCSV, type LeaderData } from '@/lib/leader-data';
import './leader-desk.css';
import { leaderRequest } from '@/lib/leader-client';

const dateLabel = (date: string) => new Date(date).toLocaleString('en-US', {
  timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
});
const choiceName = (id: string) => adventures.find(item => item.id === id)?.name ?? id;

export default function LeaderDesk({ open, onOpenChange, onChanged }: {
  open: boolean; onOpenChange: (value: boolean) => void; onChanged: () => void;
}) {
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

  async function save(body: unknown) {
    setBusy(true); setError(''); setNotice('');
    try {
      await leaderRequest(body as Record<string, unknown>);
      await load(); onChanged(); return true;
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); return false; }
    finally { setBusy(false); }
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
  return <Dialog open={open} onOpenChange={value => { if (!value) { setData(null); setNotice(''); } onOpenChange(value); }}>
    <DialogContent className="summit-dialog leader-dialog">
      <div className="desk-heading"><div><p className="desk-kicker">SUMMIT / CLUB LEADERSHIP</p><DialogTitle className="dialog-title">Your club, at a glance.</DialogTitle></div>
        <button className="desk-refresh" aria-label="Refresh leadership data" onClick={() => void load()} disabled={loading || busy}><RefreshCw size={18}/></button></div>
      <DialogDescription>See who’s joining, what they’re interested in, and what to plan next. Member information is visible only to club leaders.</DialogDescription>
      {error && <p role="alert" className="error">{error} <button onClick={() => void load()} disabled={loading}>Retry</button></p>}
      {loading && <p role="status" className="fine">Updating the leadership desk…</p>}
      {notice && <p role="status" className="desk-notice">{notice}</p>}
      {data && <>
        <div className="desk-summary" aria-label="Club totals">
          <div><Users size={17}/><strong>{data.memberCount}</strong><span>registered</span></div>
          <div><Lightbulb size={17}/><strong>{data.totalIdeas}</strong><span>student ideas</span></div>
          <div><CalendarDays size={17}/><strong>{data.events.filter(event => event.status === 'published' && Date.parse(event.starts_at) > updatedAt).length}</strong><span>upcoming events</span></div>
        </div>
        <Tabs defaultValue="members"><TabsList className="desk-tabs"><TabsTrigger value="members">Members</TabsTrigger><TabsTrigger value="ideas">Ideas & votes</TabsTrigger><TabsTrigger value="events">Events & RSVPs</TabsTrigger>{data.reports && <TabsTrigger value="reports">Member concerns {data.reports.length > 0 ? `(${data.reports.length})` : ''}</TabsTrigger>}</TabsList>
          <TabsContent value="members">
            <div className="desk-filters"><label className="desk-search"><Search size={17}/><input aria-label="Search members by name or grade" placeholder="Search name or grade" value={search} onChange={event => setSearch(event.target.value)}/></label>
              <select aria-label="Filter members by interest" value={interest} onChange={event => setInterest(event.target.value)}>{['All interests', 'Explore', 'Serve', 'Lead', 'All of it'].map(value => <option key={value}>{value}</option>)}</select></div>
            <div className="desk-roster-meta"><span>{members.length} shown · {data.memberCount} registered</span><button className="text-button" onClick={exportRoster} disabled={!members.length}><Download size={15}/> Export shown members</button></div>
            {data.memberCount > data.members.length && <p className="fine">Showing the latest {data.members.length} registrations. Older registrations are still saved in the database.</p>}
            <div className="desk-roster">{members.length ? members.map((member, index) => <article key={`${member.created_at}-${index}`}>
              <div><strong>{member.name}</strong><span>Grade {member.grade} · Joined {new Date(member.created_at).toLocaleDateString('en-US', { timeZone: 'America/Los_Angeles', month: 'short', day: 'numeric' })}</span></div>
              <span className="desk-interest">{member.interest}</span>
              {member.choices && <p>Voted for {(member.choices ?? '').split(',').map(choiceName).join(' · ')}</p>}
            </article>) : <p className="desk-empty">{data.memberCount ? 'No members match those filters.' : 'Registrations will appear here as students join.'}</p>}</div>
          </TabsContent>
          <TabsContent value="ideas">
            <div className="desk-votes"><h3>What students want to do</h3>{adventures.map(adventure => {
              const count = data.votes.find(vote => vote.adventure_id === adventure.id)?.count ?? 0;
              const maximum = Math.max(1, ...data.votes.map(vote => vote.count));
              return <div className="desk-vote" key={adventure.id}><span>{adventure.name}</span><strong>{count} {count === 1 ? 'vote' : 'votes'}</strong><div><i style={{ width: `${count / maximum * 100}%` }}/></div></div>;
            })}<p className="fine">Students can vote for more than one outing.</p></div>
            <div className="desk-interest-summary">{data.interests.map(item => <span key={item.interest}>{item.interest}<strong>{item.count}</strong></span>)}</div>
            <div className="desk-list"><h3>Ideas from the crew</h3>{data.totalIdeas > data.proposals.length && <p className="fine">Latest {data.proposals.length} of {data.totalIdeas} ideas.</p>}{data.proposals.length ? data.proposals.map(proposal => <article key={proposal.id}><span className="eyebrow">{proposal.category} · {proposal.name || 'Student idea'}</span><h4>{proposal.title}</h4><p>{proposal.description}</p><small>{dateLabel(proposal.created_at)} Pacific</small></article>) : <p className="desk-empty">Student suggestions will show up here.</p>}</div>
          </TabsContent>
          <TabsContent value="events">
            <details className="desk-create"><summary>Plan a new event</summary><form className="club-form" onSubmit={create}>
              <label>Event name<input name="title" required minLength={4} maxLength={100} placeholder="Give this outing a name"/></label>
              <div className="form-row"><label>Date & time (your local time)<input name="date" type="datetime-local" required/></label><label>Meeting location<input name="location" required minLength={3} maxLength={150}/></label></div>
              <label>What members need to know<textarea name="details" required minLength={10} maxLength={1500} rows={3} placeholder="The plan, permissions, accessibility, and what to bring"/></label>
              <button className="button" disabled={busy}>{busy ? 'Saving…' : 'Publish event'}</button></form></details>
            <div className="desk-events">{data.events.length ? data.events.map(event => <article key={event.id}><span className="eyebrow">{event.status} · {event.count} RSVPs</span><h3>{event.title}</h3><p>{dateLabel(event.starts_at)} Pacific · {event.location}</p><p>{event.details}</p>
              <details className="desk-attendees"><summary>View attendees ({event.count})</summary>{data.attendees.filter(attendee => attendee.event_id === event.id).map((attendee, index) => <p key={index}>{attendee.name} · Grade {attendee.grade}</p>)}{!event.count && <p>No RSVPs yet.</p>}</details>
              {event.status === 'published' && <button className="text-button" disabled={busy} onClick={async () => { if (await save({ action: 'cancel', id: event.id })) setNotice('Event cancelled. It is no longer accepting RSVPs.'); }}>Cancel event</button>}
            </article>) : <p className="desk-empty">Publish the first meeting when its date and location are confirmed.</p>}</div>
          </TabsContent>
          {data.reports && <TabsContent value="reports"><div className="desk-list"><h3>Member concerns</h3><p className="fine">Follow up privately through the school’s usual support process.</p>{data.reports.length ? data.reports.map(report => <article key={report.id}><span className="eyebrow">{report.reason} · {report.reported_name}</span><p>{report.details || 'No additional details.'}</p><small>{dateLabel(report.created_at)} Pacific</small><button className="text-button" disabled={busy} onClick={async () => { if (await save({ action: 'resolve', id: report.id })) setNotice('Concern marked reviewed.'); }}>Mark reviewed</button></article>) : <p className="desk-empty">No open concerns.</p>}</div></TabsContent>}
        </Tabs>
      </>}
    </DialogContent>
  </Dialog>;
}
