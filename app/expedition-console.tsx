'use client';

import { ArrowUpRight, Backpack, Check, Heart, Loader2 } from 'lucide-react';
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
  votes?: { adventure_id: string; count: number }[];
  votesFailed?: boolean;
  packedItems?: string[];
  previewOnly?: boolean;
};
const labels = ['A group hike', 'Beach cleanup', 'Trail project'];
const formatVotes = (count: number) => `${count} ${count === 1 ? 'vote' : 'votes'}`;

export default function ExpeditionConsole({ selected, onSelect, onOpenNotes, onVote, voted, busy, voteCount = 0, votesReady = true, votes, votesFailed = false, packedItems = [], previewOnly = false }: Props) {
  const active = Math.max(0, Math.min(adventures.length - 1, selected));
  const trip = adventures[active];
  const photo = outingPhotos[active];
  const counts = adventures.map((adventure, index) => {
    const count = votes ? votes.find(vote => vote.adventure_id === adventure.id)?.count ?? 0 : index === active ? voteCount : null;
    return count === null || !Number.isFinite(count) ? null : Math.max(0, Math.floor(count));
  });
  const topCount = Math.max(1, ...counts.filter((count): count is number => count !== null));
  const countLabel = (index: number) => previewOnly ? 'Voting opens at launch' : votesFailed ? 'Votes unavailable' : !votesReady ? 'Loading votes…' : counts[index] === null ? 'Votes unavailable' : formatVotes(counts[index]);
  const packedCount = trip.bring.filter(item => packedItems.includes(item)).length;

  return <Tabs className="xc-console xc-field-guide" value={String(active)} onValueChange={value => onSelect(Number(value))}>
    <TabsList className="xc-tabs" aria-label="Choose an outing idea">
      {adventures.map((adventure, index) => <TabsTrigger key={adventure.id} value={String(index)} className="xc-tab" aria-label={`${labels[index]}. ${adventure.category}. ${countLabel(index)}.`}>
        <span className="xc-tab-image" aria-hidden="true"><ClubPhoto photo={outingPhotos[index]} sizes="(max-width: 750px) 28vw, 96px"/><span className="xc-tab-number">{adventure.number}</span></span>
        <span className="xc-tab-copy"><span className="xc-tab-category">{adventure.category}</span><span className="xc-tab-name">{labels[index]}</span><span className="xc-tab-count">{countLabel(index)}</span><span className="xc-vote-track" aria-hidden="true"><i style={{ width: `${votesReady && !votesFailed && !previewOnly ? (counts[index] ?? 0) / topCount * 100 : 0}%` }}/></span></span>
      </TabsTrigger>)}
    </TabsList>
    <TabsContent className="xc-body" value={String(active)}>
      <figure className="xc-photo">
        <div className="xc-landscape"><ClubPhoto photo={photo} sizes="(max-width: 750px) 88vw, (max-width: 1372px) 37vw, 502px"/><div className="xc-photo-label" aria-hidden="true"><span>0{active + 1} / OUTSIDE TOGETHER</span><strong>{trip.category}.</strong></div></div>
        <PhotoCredit photo={photo}/>
      </figure>
      <div className="xc-plan">
        <div className="xc-copy"><p className="xc-category">Help choose our next outing</p><h3>{trip.name}</h3><p className="xc-description">{trip.description}</p></div>
        <dl className="xc-facts"><div><dt>Time outside</dt><dd>{trip.duration}</dd></div><div><dt>The plan</dt><dd>{trip.level}</dd></div><div><dt>Dates &amp; location</dt><dd>To be confirmed</dd></div></dl>
        <div className="xc-actions">
          <button type="button" className={`xc-vote ${voted ? 'is-voted' : ''}`} onClick={onVote} aria-label={`${voted ? 'Remove your vote for' : 'Vote for'} ${trip.name}. ${countLabel(active)}.`} aria-pressed={voted} disabled={busy || previewOnly}>{busy ? <Loader2 size={17} className="spin"/> : voted ? <Check size={17}/> : <Heart size={17}/>}<span>{previewOnly ? 'Voting opens at launch' : busy ? 'Saving…' : voted ? 'You voted for this' : 'Vote for this outing'}</span><b>{votesReady && !votesFailed && !previewOnly && counts[active] !== null ? formatVotes(counts[active]) : '—'}</b></button>
          <p className="xc-vote-note">Vote for more than one. Leadership confirms the plan.</p>
        </div>
        <div className="xc-field-notes">
          <div className="xc-notes-heading"><span><Backpack size={17} strokeWidth={1.5} aria-hidden="true"/>Your field notes</span><span>{packedCount}/{trip.bring.length} packed</span></div>
          <div className="xc-pack-track" role="progressbar" aria-label="Packing checklist" aria-valuemin={0} aria-valuemax={trip.bring.length} aria-valuenow={packedCount} aria-valuetext={`${packedCount} of ${trip.bring.length} items packed`}><i style={{ width: `${packedCount / trip.bring.length * 100}%` }}/></div>
          <ul className="xc-pack-preview">{trip.bring.slice(0, 3).map(item => <li key={item} data-packed={packedItems.includes(item)}><span className="xc-pack-dot" aria-hidden="true">{packedItems.includes(item) && <Check size={11} strokeWidth={2}/>}</span><span>{item}</span>{packedItems.includes(item) && <span className="sr-only"> (packed)</span>}</li>)}</ul>
          <div className="xc-notes-footer"><button type="button" className="xc-notes" onClick={onOpenNotes}>Open your checklist<ArrowUpRight size={16} strokeWidth={1.6}/></button><p>Saved on this device.<br/>Update it when plans are confirmed.</p></div>
        </div>
      </div>
    </TabsContent>
  </Tabs>;
}
