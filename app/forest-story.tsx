'use client';

import { useId } from 'react';
import { Plus } from 'lucide-react';
import './forest-story.css';

export default function ForestStory({ onJoin }: { onJoin: () => void }) {
  const uid = useId().replace(/:/g, '');

  return <section id="basecamp" className="forest-story" aria-labelledby={`forest-title-${uid}`}>
    <div className="forest-photo" aria-hidden="true" />
    <div className="forest-photo-shade" aria-hidden="true" />
    <div className="forest-story-inner">
      <div className="forest-intro">
        <p className="forest-kicker"><strong>SUMMIT</strong><span>Cathedral Catholic High School</span></p>
        <h2 id={`forest-title-${uid}`}>Good people.<br />More outside.</h2>
        <p className="forest-intro-copy">Hikes, service projects, and adventures planned by Cathedral Catholic students.</p>
        <ul className="forest-facts">
          <li><strong>Who</strong><span>All CCHS students. No experience needed.</span></li>
          <li><strong>When</strong><span>First meeting being planned.</span></li>
          <li><strong>Club lead</strong><span>Tobias Kell · Founder &amp; President</span></li>
        </ul>
        <button type="button" className="forest-join" onClick={onJoin}>Join SUMMIT <Plus size={17} strokeWidth={1.7} aria-hidden="true" /></button>
        <a className="forest-next" href="#expeditions">See what’s next <span aria-hidden="true">↘</span></a>
      </div>
    </div>
  </section>;
}
