'use client';

import { Backpack, Check, Heart, Loader2 } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adventures } from '@/lib/adventures';
import { outingPhotos } from '@/lib/club-photos';
import { ClubPhoto, PhotoCredit } from './club-photo';
import './expedition-console.css';

type Props = {
  selected: number;
  onSelect: (index: number) => void;
  onOpenNotes: () => void;
  onVote: () => void;
  voted: boolean;
  busy: boolean;
  voteCount?: number;
  votesReady?: boolean;
};
const labels = ['A group hike', 'Beach cleanup', 'Trail project'];

export default function ExpeditionConsole({ selected, onSelect, onOpenNotes, onVote, voted, busy, voteCount = 0, votesReady = true }: Props) {
  const active = Math.max(0, Math.min(adventures.length - 1, selected));
  const trip = adventures[active];
  const photo = outingPhotos[active];
  const countLabel = votesReady ? `${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}` : 'Votes loading';

  return <Tabs className="xc-console" value={String(active)} onValueChange={value => onSelect(Number(value))}>
    <TabsList className="xc-tabs" aria-label="Choose an outing idea">
      {adventures.map((adventure, index) => <TabsTrigger key={adventure.id} value={String(index)} className="xc-tab"><span>{labels[index]}</span><i aria-hidden="true" /></TabsTrigger>)}
    </TabsList>
    <TabsContent className="xc-body" value={String(active)}>
      <figure className="xc-photo">
        <div className="xc-landscape"><ClubPhoto photo={photo} sizes="(max-width: 750px) 88vw, (max-width: 1372px) 37vw, 502px" /><span aria-hidden="true">{trip.category}</span></div>
        <PhotoCredit photo={photo} />
      </figure>
      <div className="xc-plan"><div className="xc-copy"><p className="xc-category">Proposed outing · chosen by the club</p><h3>{trip.name}</h3><p className="xc-description">{trip.description}</p></div>
      <dl className="xc-facts"><div><dt>Time outside</dt><dd>{trip.duration}</dd></div><div><dt>The plan</dt><dd>{trip.level}</dd></div><div><dt>Dates &amp; location</dt><dd>To be confirmed</dd></div></dl>
      <div className="xc-actions">
        <button type="button" className={`xc-vote ${voted ? 'is-voted' : ''}`} onClick={onVote} aria-label={`${voted ? 'Remove your vote for' : 'Vote for'} ${trip.name}. ${countLabel}.`} aria-pressed={voted} disabled={busy}>{busy ? <Loader2 size={17} className="spin" /> : voted ? <Check size={17} /> : <Heart size={17}/>}<span>{busy ? 'Saving…' : voted ? 'You voted for this' : 'Vote for this outing'}</span><b>{votesReady ? `${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}` : '—'}</b></button>
        <button type="button" className="xc-notes" onClick={onOpenNotes}><Backpack size={17} strokeWidth={1.5}/>Plan &amp; packing list</button>
        <p className="xc-vote-note">Votes help us choose.<br />Leadership confirms the plan.</p>
      </div>
      </div>
    </TabsContent>
  </Tabs>;
}
