'use client';

import { useId } from 'react';
import { Plus } from 'lucide-react';
import './forest-story.css';

type Props = {
  onJoin: () => void;
  member?: boolean;
  nextEvent?: { title: string; starts_at: string; location: string } | null;
  loading?: boolean;
  loadFailed?: boolean;
};

export default function ForestStory({ onJoin, member = false, nextEvent, loading = false, loadFailed = false }: Props) {
  const uid = useId().replace(/:/g, '');
  const meetingTitle = nextEvent?.title || (loading ? 'Checking the calendar…' : loadFailed ? 'Calendar unavailable' : 'First meeting being planned.');
  const meetingDate = nextEvent ? new Date(nextEvent.starts_at).toLocaleString('en-US', { timeZone: 'America/Los_Angeles', month: 'long', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : null;

  return <section id="basecamp" className="forest-story" aria-labelledby={`forest-title-${uid}`}>
    <div className="forest-story-inner">
      <div className="forest-intro">
        <p className="forest-kicker"><span aria-hidden="true" /> CATHEDRAL CATHOLIC HIGH SCHOOL</p>
        <h2 id={`forest-title-${uid}`}>Meet your<br />outdoor club.</h2>
        <p className="forest-intro-copy">SUMMIT brings Cathedral Catholic students together for outdoor adventure, community service, and student leadership.</p>
        <p className="forest-audience">Every grade. No outdoor experience needed.</p>
        <div className="forest-actions"><button type="button" className="forest-join" onClick={onJoin}>{member ? 'Open my club pass' : 'Join the club'}<Plus size={17} strokeWidth={1.7} aria-hidden="true" /></button><a className="forest-next" href="#expeditions">See outing ideas</a></div>
      </div>
      <aside className="forest-notice" aria-label="Club meeting and leadership">
        <p className="forest-notice-label">{nextEvent ? 'NEXT ON THE CALENDAR' : 'CLUB NOTICE'}</p>
        <h3>{meetingTitle}</h3>
        {nextEvent ? <><p className="forest-meeting-date">{meetingDate} Pacific</p><p className="forest-meeting-place">{nextEvent.location}</p><a href="#calendar" className="forest-calendar-link">Details &amp; RSVP</a></> : <p className="forest-meeting-copy">{loading ? 'Looking for the latest club plans.' : loadFailed ? 'We couldn’t load the latest plans. Try reconnecting below.' : 'The date and place will appear here once confirmed. In the meantime, help choose our first outing.'}</p>}
        <div className="forest-lead"><span className="forest-lead-initials" aria-hidden="true">TK</span><div><strong>Tobias Kell</strong><span>Founder &amp; President</span></div></div>
      </aside>
    </div>
  </section>;
}
