'use client';

import { useId } from 'react';
import { Plus } from 'lucide-react';
import './forest-story.css';
import media from './journey-media.json';

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
        <h2 id={`forest-title-${uid}`} aria-label="SUMMIT Outdoor Club">SUMMIT<span>Outdoor Club</span></h2>
        <p className="forest-intro-copy">A student-led club for outdoor adventure, community service, and leadership.</p>
        <p className="forest-audience">Open to every Cathedral Catholic student.<br />No outdoor experience needed.</p>
        <div className="forest-actions"><button type="button" className="forest-join" onClick={onJoin}>{member ? 'View registration' : 'Join SUMMIT'}<Plus size={17} strokeWidth={1.7} aria-hidden="true" /></button><a className="forest-next" href="#expeditions">See outing ideas</a></div>
      </div>
      <aside className="forest-notice" aria-label="Club meeting and leadership">
        <div className="forest-panorama" aria-hidden="true" style={{backgroundImage: `linear-gradient(#10251d08,#10251d24),url(${media.path}/overlook.webp)`}} />
        <div className="forest-notice-copy"><p className="forest-notice-label">{nextEvent ? 'NEXT ON THE CALENDAR' : 'MEETING UPDATE'}</p>
        <h3>{meetingTitle}</h3>
        {nextEvent ? <><p className="forest-meeting-date">{meetingDate} Pacific</p><p className="forest-meeting-place">{nextEvent.location}</p><a href="#calendar" className="forest-calendar-link">Details &amp; RSVP</a></> : <p className="forest-meeting-copy">{loading ? 'Looking for the latest club plans.' : loadFailed ? 'We couldn’t load the latest plans. Try reconnecting below.' : 'The date and place will appear here once confirmed.'}</p>}
        <p className="forest-lead"><strong>Tobias Kell</strong><span>Founder &amp; President</span></p></div>
      </aside>
    </div>
  </section>;
}
