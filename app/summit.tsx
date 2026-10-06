'use client';
import { useCallback,useEffect,useRef,useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus,Menu,X,Download,CheckCircle2 } from 'lucide-react';
import { Dialog,DialogContent,DialogTitle,DialogDescription } from '@/components/ui/dialog';
import { Tabs,TabsList,TabsTrigger,TabsContent } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Select,SelectTrigger,SelectValue,SelectContent,SelectItem } from '@/components/ui/select';
import LeaderDesk from './leader-desk';
import SummitExperience from './summit-experience';
import ExpeditionConsole from './expedition-console';
import ForestStory from './forest-story';
import FirstOuting from './first-outing';
import { SummitMark, SummitWordmark } from './summit-brand';
import './forest-continuity.css';
import { cloudConfigured } from '@/lib/cloud-client';
import { MemberSignOut } from './member-auth';
import { adventures } from '@/lib/adventures';
import { signInFor, readSignInIntent, signInForVote, readVoteIntent } from '@/lib/signin-intent';
import { sitePath } from '@/lib/site-path';
import { basecampRequest, type BasecampState as State, type VoteState } from '@/lib/basecamp-client';
const values=[['S','Serve your community','Use our time and abilities to make a positive difference.'],['U','Unplug and get outside','Step away from screens and experience more of the world around us.'],['M','Move beyond your comfort zone','Try something new, challenge yourself, and grow.'],['M','Make an impact','Leave our school, community, and outdoor spaces better than we found them.'],['I','Inspire others','Bring people together and encourage others to participate.'],['T','Take the lead','Develop the confidence to contribute ideas, organize, serve, and lead.']];
const peaks=[['P','Push your limits','Challenge yourself physically, personally, and as a leader.'],['E','Explore what’s out there','Experience new places, activities, people, and perspectives.'],['A','Act with service','Look for opportunities to help rather than waiting to be asked.'],['K','Keep climbing','Continue growing, learning, and moving forward.']];
export default function Summit(){
const router=useRouter();
const [leaderOpen,setLeaderOpen]=useState(false);
const [arrived,setArrived]=useState(false);
const [loading,setLoading]=useState(true),[loadError,setLoadError]=useState('');
const [selected,setSelected]=useState(0),[modal,setModal]=useState<'idea'|'trip'|'vote'|null>(null),[menu,setMenu]=useState(false),[state,setState]=useState<State|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(''),[category,setCategory]=useState('Explore'),[packed,setPacked]=useState<string[]>([]);
const headerRef=useRef<HTMLElement>(null);
const restoredInitialHash=useRef(false);
const requestId=useRef('');const trip=adventures[selected];
const readVersion=useRef(0),writing=useRef(false),lastRefresh=useRef(0);
const refresh=useCallback(async()=>{
 const version=++readVersion.current;lastRefresh.current=Date.now();setLoading(true);
 try{const data=await basecampRequest<State>();if(version===readVersion.current){setState(data);setLoadError('');}return data;}
 catch(e){if(version===readVersion.current)setLoadError(e instanceof Error?e.message:'Could not load basecamp. Please try again.');throw e;}
 finally{if(version===readVersion.current)setLoading(false);}
},[]);
function retryBasecamp(){setError('');void refresh().catch(()=>undefined);}
// Restore device-only checklist after hydration; server output must stay deterministic.
// eslint-disable-next-line react-hooks/set-state-in-effect
useEffect(()=>{void refresh().catch(()=>undefined);try{const saved:unknown=JSON.parse(localStorage.getItem('summit-pack')||'[]');if(Array.isArray(saved))setPacked(saved.filter((item):item is string=>typeof item==='string'));}catch{}},[refresh]);
// Keep totals and registration current across visitors and browser tabs.
useEffect(()=>{
 const reads=readVersion;
 const update=()=>{if(document.visibilityState==='visible'&&!writing.current&&Date.now()-lastRefresh.current>2000)void refresh().catch(()=>undefined);};
 const timer=window.setInterval(update,30000);window.addEventListener('focus',update);window.addEventListener('pageshow',update);document.addEventListener('visibilitychange',update);window.addEventListener('summit:member-change',update);
 return()=>{window.clearInterval(timer);window.removeEventListener('focus',update);window.removeEventListener('pageshow',update);document.removeEventListener('visibilitychange',update);window.removeEventListener('summit:member-change',update);reads.current++;};
},[refresh]);
useEffect(()=>{
 if(!state||restoredInitialHash.current)return;
 restoredInitialHash.current=true;
 const hash=location.hash;
 if(!['#basecamp','#calendar','#expeditions','#board','#club','#join'].includes(hash))return;
 // Saved events and ideas can shift a deep link after the first render.
 const frame=requestAnimationFrame(()=>window.dispatchEvent(new CustomEvent('summit:navigate',{detail:hash.slice(1)})));
 return()=>cancelAnimationFrame(frame);
},[state]);
useEffect(()=>{
 const header=headerRef.current;if(!header)return;
 const observer=new IntersectionObserver(entries=>{for(const entry of entries){if(entry.isIntersecting){header.querySelectorAll('nav a').forEach(link=>{if(link.getAttribute('href')==='#'+entry.target.id)link.setAttribute('aria-current','location');else link.removeAttribute('aria-current');});}}},{rootMargin:'-15% 0px -55% 0px',threshold:0});
 ['basecamp','expeditions','board','club'].forEach(id=>{const el=document.getElementById(id);if(el)observer.observe(el);});return()=>observer.disconnect();
},[]);
useEffect(()=>{
 if(!state?.signedIn)return;
 const intent=readSignInIntent(location.search), outing=readVoteIntent(location.search);if(!intent&&!outing)return;
 const url=new URL(location.href);url.searchParams.delete('afterSignIn');if(outing)url.searchParams.delete('outing');
 const frame=requestAnimationFrame(()=>{
   history.replaceState(history.state,'',url.pathname+url.search+url.hash);setError('');
   if(outing){setSelected(adventures.findIndex(item=>item.id===outing));setModal('vote');window.dispatchEvent(new CustomEvent('summit:navigate',{detail:'expeditions'}));}
   else if(intent==='join'){location.replace(sitePath('/register'));}
   else if(intent==='idea'){setModal('idea');requestId.current=crypto.randomUUID();}
 });
 return()=>cancelAnimationFrame(frame);
},[state?.signedIn]);
function enterClub(e:React.MouseEvent<HTMLAnchorElement>){e.preventDefault();window.dispatchEvent(new Event('summit:enter'));}
useEffect(()=>{if(!notice)return;const t=setTimeout(()=>setNotice(''),5000);return()=>clearTimeout(t);},[notice]);
function open(which:'join'|'idea'|'trip'|'vote'){if(which==='join'){router.push('/register');return;}setError('');setModal(which);if(which==='idea')requestId.current=crypto.randomUUID();}
async function mutate(body:Record<string,unknown>,key:string){
 if(writing.current)return false;
 writing.current=true;readVersion.current++;setLoading(false);setBusy(key);setError('');
 try{await basecampRequest({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});await refresh().catch(()=>undefined);return true;}
 catch(e){setError(e instanceof Error?e.message:'Could not save. Try again.');return false;}
 finally{writing.current=false;setBusy('');}
}
async function vote(id:string){
 if(cloudConfigured && state?.signedIn && !state.member){router.push('/register');return false;}
 if(!state?.signedIn){const index=adventures.findIndex(item=>item.id===id);if(index>=0)setSelected(index);open('vote');return false;}
 if(writing.current)return false;
 const voted=state.myVotes.some(v=>v.adventure_id===id);
 writing.current=true;readVersion.current++;setLoading(false);setBusy(id);setError('');
 try{
   const saved=await basecampRequest<VoteState>({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'vote',adventureId:id,selected:!voted})});
   readVersion.current++;setState(current=>current?{...current,votes:saved.votes,myVotes:saved.myVotes}:current);setLoadError('');
   setNotice(voted?'Vote removed.':'Vote counted. Your crew helps choose what’s next.');return true;
 }catch(e){setError(e instanceof Error?e.message:'Could not save your vote. Try again.');return false;}
 finally{writing.current=false;setLoading(false);setBusy('');}
}
async function rsvp(id:string){if(!state?.member){open('join');return;}const saved=state.rsvps.some(r=>r.event_id===id);if(await mutate({action:'rsvp',eventId:id,selected:!saved},id))setNotice(saved?'RSVP removed.':'RSVP saved. Check event details and required permissions.');}
async function propose(e:FormEvent<HTMLFormElement>){e.preventDefault();const f=new FormData(e.currentTarget);if(await mutate({action:'propose',title:f.get('title'),description:f.get('description'),category,requestId:requestId.current},'idea')){setModal(null);setNotice('Idea saved to your basecamp and the leadership desk.');}}
function pack(item:string){const next=packed.includes(item)?packed.filter(x=>x!==item):[...packed,item];setPacked(next);try{localStorage.setItem('summit-pack',JSON.stringify(next));}catch{setNotice('Checklist updated for this visit. This browser could not save it for next time.');}}
function downloadPlan(){const blob=new Blob([`SUMMIT FIELD NOTES\n${trip.name}\n${trip.place}\n\nPROPOSED EXPERIENCE — NOT A SCHEDULED EVENT\n${trip.description}\n\nPACK LIST\n${trip.bring.map(x=>`${packed.includes(x)?'[x]':'[ ]'} ${x}`).join('\n')}\n\n${trip.note}\n\nFounder & President: Tobias Kell\nCathedral Catholic High School\nExplore. Serve. Lead.`],{type:'text/plain'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`summit-${trip.id}-field-notes.txt`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
const connectionPrompt=<div className="auth-prompt"><p role={loadError?'alert':'status'}>{loading?'Connecting to basecamp…':loadError||'Connect to basecamp to continue.'}</p><button className="button" disabled={loading} onClick={retryBasecamp}>{loading?'Connecting…':'Try again'}</button></div>;
return <><a className="skip" href="#basecamp" onClick={enterClub}>Skip to club basecamp</a><header ref={headerRef} className="masthead journey-nav" data-arrived={arrived}><a href="#home" className="wordmark" aria-label="SUMMIT home"><SummitMark motion="entrance" active={arrived}/><SummitWordmark/><span>CATHEDRAL CATHOLIC<br/>OUTDOOR CLUB</span></a><nav className={menu?'open':''}><a onClick={e=>{setMenu(false);enterClub(e)}} href="#basecamp">The club</a><a onClick={()=>setMenu(false)} href="#expeditions">What’s next</a><a onClick={()=>setMenu(false)} href="#board">Your ideas</a><Link className="member-profile-nav" onClick={()=>setMenu(false)} href="/profile/">My crew</Link></nav><Link className="join-nav" href="/register">{state?.member?'My registration':'Join SUMMIT'}<Plus size={17}/></Link><button className="mobile-menu" aria-label="Toggle navigation" aria-expanded={menu} onClick={()=>setMenu(!menu)}>{menu?<X/>:<Menu/>}</button></header>
<main>
  <SummitExperience onJoin={()=>open('join')} onReveal={setArrived}>
    <ForestStory brandActive={arrived} onJoin={()=>open('join')} member={!!state?.member} nextEvent={state?.events[0]} loading={!state&&loading} loadFailed={!state&&!!loadError}/>
    <div className="camp-content">
      {state?.previewOnly&&<p className="deployment-preview-note">Website preview · Explore the hike and club. Registration and voting open once the live backend is connected.</p>}
      {!!state?.events?.length&&<section className="camp-calendar section" id="calendar" aria-labelledby="calendar-title"><div className="upcoming-events"><div className="calendar-heading"><h2 id="calendar-title">On the calendar</h2><p>Confirmed by club leadership · Pacific time</p></div>{state.events.map(event=><article className="event-card" key={event.id}><div className="event-date"><span>{new Date(event.starts_at).toLocaleDateString('en-US',{timeZone:'America/Los_Angeles',month:'short'})}</span><strong>{new Date(event.starts_at).toLocaleDateString('en-US',{timeZone:'America/Los_Angeles',day:'numeric'})}</strong></div><div><h3>{event.title}</h3><span>{new Date(event.starts_at).toLocaleTimeString('en-US',{timeZone:'America/Los_Angeles',hour:'numeric',minute:'2-digit'})} Pacific · {event.location}</span><p>{event.details}</p></div><button className="button" disabled={!!busy} onClick={()=>rsvp(event.id)}>{state.rsvps.some(r=>r.event_id===event.id)?'Remove RSVP':'Count me in'}</button></article>)}</div></section>}
      <section className="expeditions section" id="expeditions" aria-labelledby="outings-title">
        <div className="next-heading"><div><span className="field-guide-kicker">THE SUMMIT FIELD GUIDE</span><h2 id="outings-title">Where should we go next?</h2></div><p>Three starting points. Your votes help choose what happens next.</p></div>
        <ExpeditionConsole selected={selected} onSelect={setSelected} onOpenNotes={()=>open('trip')} onVote={()=>vote(trip.id)} voted={!!state?.myVotes.some(v=>v.adventure_id===trip.id)} busy={!!busy} voteCount={state?.votes.find(v=>v.adventure_id===trip.id)?.count??0} votesReady={!!state} votes={state?.votes} votesFailed={!!loadError} packedItems={packed} previewOnly={state?.previewOnly}/>
        <p className="outing-photo-note">Photos show examples of adventure and service, not past SUMMIT trips. <a href={sitePath('/photos/credits.txt')} target="_blank" rel="noopener noreferrer">Photo credits &amp; licenses</a></p>
        {(error||loadError)&&!modal&&<div className="error" role="alert">{error||loadError} <button disabled={loading} onClick={retryBasecamp}>{loading?'Connecting…':'Retry'}</button></div>}
      </section>
      <section className="board section" id="board" aria-labelledby="ideas-title">
        <div className="idea-strip"><div><h2 id="ideas-title">Have another idea?</h2><p>Send an outing or service suggestion to club leadership.</p></div><button className="idea-button" disabled={state?.previewOnly} onClick={()=>open('idea')}>{state?.previewOnly?'Suggestions open at launch':'Share an idea'} <Plus size={17}/></button></div>
        {!!state?.proposals.length&&<details className="saved-ideas"><summary>Your saved ideas ({state.proposals.length})</summary><div>{state.proposals.map(p=><article key={p.id}><strong>{p.title}</strong><p>{p.description}</p></article>)}</div></details>}
      </section>
      <FirstOuting/>
      <section id="club" className="club-notes section"><details><summary>Our values &amp; the SUMMIT name <Plus size={16}/></summary><div className="club-notes-content"><p>Explore. Serve. Lead. We get outside, give back, and grow by making things happen together.</p><dl>{values.map(v=><div key={v[1]}><dt><span>{v[0]}</span>{v[1]}</dt><dd>{v[2]}</dd></div>)}</dl><h3>The PEAK mindset</h3><dl>{peaks.map(p=><div key={p[0]}><dt><span>{p[0]}</span>{p[1]}</dt><dd>{p[2]}</dd></div>)}</dl></div></details></section>
      <section className="club-signup section" id="join" aria-labelledby="join-title"><div><p className="registration-summary-status">{!state?(loadError?'Status unavailable':'Checking registration…'):state.previewOnly?'Registration opens at launch':state.member?'Registered with SUMMIT':'Not registered yet'}</p><h2 id="join-title">{state?.member?'You’re registered.':'Join SUMMIT'}</h2><p>{state?.member?'Your interest is saved. Check the calendar and help choose our next outing.':'Register your interest with your name, grade, and what you’d like to do.'}</p></div><div className="club-signup-action"><Link className="button" href="/register">{state?.member?'View registration':'Register your interest'}<Plus size={17}/></Link></div></section>
    </div>
  </SummitExperience>
</main>
<LeaderDesk open={leaderOpen} onOpenChange={setLeaderOpen} onChanged={retryBasecamp}/><footer className="club-footer"><a className="wordmark" href="#home" aria-label="SUMMIT home"><SummitMark/><SummitWordmark/></a>{state?.leader&&<button className="text-button" onClick={()=>setLeaderOpen(true)}>Leadership desk</button>}{!state?.leader&&<a className="text-button" href={sitePath('/leadership')}>Club leadership</a>}{state?.signedIn&&(cloudConfigured?<MemberSignOut onDone={retryBasecamp}/>:<a className="text-button" href="/signout-with-chatgpt?return_to=/%23basecamp" target="_top">Sign out</a>)}<p>Cathedral Catholic High School<br/><small>Student-led outdoor adventure club</small></p></footer>
{notice&&<div className="toast" role="status"><CheckCircle2 size={20}/>{notice}</div>}
<Dialog open={modal!==null} onOpenChange={v=>{if(!v)setModal(null)}}><DialogContent className="summit-dialog"><DialogTitle className="dialog-title">{modal==='idea'?'Share an outing idea.':modal==='vote'?`Vote for ${trip.name.toLowerCase()}`:trip.name}</DialogTitle><DialogDescription>{modal==='idea'?'Pitch an adventure or service idea to club leadership.':modal==='vote'?'Help the crew choose what to plan next.':'Proposed experience · final details to be confirmed.'}</DialogDescription>
{modal==='vote'&&(!state?connectionPrompt:!state.signedIn?<div className="auth-prompt"><p>Your choice is <strong>{trip.name}</strong>. Sign in to save your vote; you’ll return to this outing to confirm it.</p><a className="button" href={signInForVote(trip.id)} target="_top">Sign in to SUMMIT</a><p className="fine">Voting helps choose the plan. It doesn’t register you for an outing.</p></div>:<div className="vote-confirmation"><p>{trip.description}</p>{state.myVotes.some(v=>v.adventure_id===trip.id)?<><p className="registration-state"><CheckCircle2 size={18} aria-hidden="true"/>Your vote is already saved.</p><button className="button" onClick={()=>setModal(null)}>Back to outing ideas</button></>:<><p className="fine">You can vote for more than one idea. Leadership confirms dates and details.</p><button className="button" disabled={!!busy} onClick={async()=>{if(await vote(trip.id))setModal(null)}}>{busy===trip.id?'Saving…':'Confirm my vote'}</button></>}</div>)}
{modal==='idea'&&(!state?connectionPrompt:!state.signedIn?<div className="auth-prompt"><p>Sign in so your idea stays saved to your basecamp.</p><a className="button" href={signInFor('idea')} target="_top">Sign in to SUMMIT</a></div>:cloudConfigured&&!state.member?<div className="auth-prompt"><p>Finish your club registration before sending an idea.</p><Link className="button" href="/register/">Finish registration</Link></div>:<form className="club-form" onSubmit={propose}><label>Name your idea<input name="title" required minLength={5} maxLength={90} placeholder="What should we do?"/></label><label>Category<Select value={category} onValueChange={setCategory}><SelectTrigger aria-label="Idea category"><SelectValue/></SelectTrigger><SelectContent>{['Explore','Serve','Lead'].map(g=><SelectItem key={g} value={g}>{g}</SelectItem>)}</SelectContent></Select></label><label>The plan<textarea name="description" required minLength={15} maxLength={600} rows={4} placeholder="Where could we go? How could we help? What makes it a good club activity?"/></label><p className="fine">Saved to your basecamp and the leadership desk for review and planning.</p><button className="button" disabled={!!busy}>{busy==='idea'?'Saving…':'Save my idea'}</button></form>)}
{modal==='trip'&&<><p>{trip.description}</p><Tabs defaultValue="pack" className="trip-tabs"><TabsList><TabsTrigger value="pack">Pack list</TabsTrigger><TabsTrigger value="details">Before we go</TabsTrigger></TabsList><TabsContent value="pack"><p className="fine">Your checklist stays on this device. Adjust it once the outing is confirmed.</p><div className="pack-progress"><span>{trip.bring.filter(x=>packed.includes(x)).length}/{trip.bring.length} packed</span><div><i style={{width:`${trip.bring.filter(x=>packed.includes(x)).length/trip.bring.length*100}%`}}/></div></div>{trip.bring.map(item=><label className="pack-item" key={item}><Checkbox checked={packed.includes(item)} onCheckedChange={()=>pack(item)}/><span>{item}</span></label>)}</TabsContent><TabsContent value="details"><p>{trip.note}</p><p>Stay with your group, follow the trip leader’s directions, and check the confirmed event information before heading out.</p></TabsContent></Tabs><button className="button" onClick={downloadPlan}><Download size={17}/> Download field notes</button></>}
{error&&<p className="error" role="alert">{error}</p>}{loadError&&state&&modal!=='trip'&&<div className="error" role="alert">{loadError} <button disabled={loading} onClick={retryBasecamp}>{loading?'Connecting…':'Retry'}</button></div>}</DialogContent></Dialog></>;
}
