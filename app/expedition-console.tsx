'use client';

import { Backpack, Check, Heart, Loader2, Mountain, Waves, Sprout } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { adventures } from '@/lib/adventures';
import './expedition-console.css';

type Props = {
  selected: number;
  onSelect: (index: number) => void;
  onOpenNotes: () => void;
  onVote: () => void;
  voted: boolean;
  busy: boolean;
  voteCount?: number;
};
const labels = ['Hike', 'Beach cleanup', 'Trail project'];
const icons = [Mountain, Waves, Sprout];

export default function ExpeditionConsole({ selected, onSelect, onOpenNotes, onVote, voted, busy, voteCount = 0 }: Props) {
  const active = Math.max(0, Math.min(adventures.length - 1, selected));
  const trip = adventures[active];
  return <Tabs className="xc-console" value={String(active)} onValueChange={value => onSelect(Number(value))}>
    <TabsList className="xc-tabs" aria-label="Choose an outing idea">
      {adventures.map((adventure, index) => {
        const Icon = icons[index];
        return <TabsTrigger key={adventure.id} value={String(index)} className="xc-tab"><Icon size={19} strokeWidth={1.5}/>{labels[index]}</TabsTrigger>;
      })}
    </TabsList>
    <TabsContent className="xc-body" value={String(active)}>
      <div className="xc-copy"><h3>{trip.name}</h3><p>{trip.description}</p></div>
      <dl className="xc-facts"><div><dt>Time outside</dt><dd>{trip.duration}</dd></div><div><dt>Plan</dt><dd>{trip.level}</dd></div></dl>
      <div className="xc-actions">
        <button type="button" className={`xc-vote ${voted ? 'is-voted' : ''}`} onClick={onVote} aria-label={`${voted ? 'Remove your vote for' : 'Vote for'} ${trip.name}. ${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}.`} aria-pressed={voted} disabled={busy}>{busy ? <Loader2 size={17} className="spin" /> : voted ? <Check size={17} /> : <Heart size={17}/>}<span>{voted ? 'Voted' : 'Vote for this'}</span><b>{voteCount}</b></button>
        <button type="button" className="xc-notes" onClick={onOpenNotes}>What to bring <Backpack size={17} strokeWidth={1.5}/></button>
      </div>
    </TabsContent>
  </Tabs>;
}
