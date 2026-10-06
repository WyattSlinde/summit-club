'use client';

import { useId } from 'react';
import { ArrowDownRight, ArrowRight } from 'lucide-react';
import { SummitWordmark } from './summit-brand';
import media from './journey-media.json';
import './forest-story.css';
import { clubPhotos } from '@/lib/club-photos';
import { ClubPhoto, PhotoCredit } from './club-photo';

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
    <div className="forest-arrival">
      <picture className="forest-arrival-scene">
        <source media="(max-aspect-ratio: 9/16)" srcSet="/summit-arrival/overlook-mobile.webp"/>
        <img src="/summit-arrival/overlook.webp" alt="" width={media.width} height={media.height} loading="eager" fetchPriority="low" decoding="async"/>
      </picture>
      <div className="forest-arrival-shade"/>
      <div className="forest-story-inner">
        <div className="forest-intro">
          <p className="forest-kicker">Cathedral Catholic High School · Outdoor Club</p>
          <h2 id={`forest-title-${uid}`} aria-label="SUMMIT"><SummitWordmark/></h2>
          <p className="forest-arrival-line">Outside is better together.</p>
          <p className="forest-intro-copy">Outdoor adventures. Service that matters. A student-led crew open to every Cathedral student.</p>
          <div className="forest-actions">
            <button type="button" className="forest-join" onClick={onJoin}>{member ? 'View registration' : 'Join SUMMIT'}<ArrowRight size={18} strokeWidth={1.6} aria-hidden="true"/></button>
            <a className="forest-next" href="#expeditions">Find your next adventure<ArrowDownRight size={17} strokeWidth={1.6} aria-hidden="true"/></a>
          </div>
          <p className="forest-audience">No experience needed. Just come as you are.</p>
        </div>
        <p className="forest-arrival-caption"><span>EXPLORE. SERVE. LEAD.</span><span>The view is only the beginning.</span></p>
      </div>
    </div>
    <div className="forest-details">
      <div className="forest-welcome">
        <p className="forest-notice-label">YOUR PEOPLE. YOUR PLANS.</p>
        <h3>A club you help build.</h3>
        <p>Pitch the trail. Pick the project. Bring a friend. Members choose what’s next and help make it happen.</p>
        <p className="forest-lead"><strong>Tobias Kell</strong><span>Founder &amp; President</span></p>
      </div>
      <aside className="forest-notice" aria-label="Club meeting" aria-live="polite" aria-busy={loading}>
        <p className="forest-notice-label">{nextEvent ? 'NEXT ON THE CALENDAR' : 'MEETING UPDATE'}</p>
        <h3>{meetingTitle}</h3>
        {nextEvent ? <><p className="forest-meeting-date"><time dateTime={nextEvent.starts_at}>{meetingDate} Pacific</time></p><p className="forest-meeting-place">{nextEvent.location}</p><a href="#calendar" className="forest-calendar-link">Details &amp; RSVP<ArrowRight size={16} strokeWidth={1.6} aria-hidden="true"/></a></>
          : <p className="forest-meeting-copy">{loading ? 'Looking for the latest club plans.' : loadFailed ? 'We couldn’t load the latest plans. Try reconnecting below.' : 'The date and place will appear here once confirmed.'}</p>}
      </aside>
      <figure className="forest-photo"><div className="forest-panorama"><ClubPhoto photo={clubPhotos.arrival} sizes="(max-width: 700px) 88vw, 24vw"/></div><PhotoCredit photo={clubPhotos.arrival}/></figure>
    </div>
  </section>;
}
