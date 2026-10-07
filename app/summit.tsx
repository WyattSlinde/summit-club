'use client';
import { useEffect, useState, type MouseEvent } from 'react';
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import SummitExperience from './summit-experience';
import ForestStory from './forest-story';
import Registration from './register/registration';
import { SummitMark, SummitWordmark } from './summit-brand';
import './forest-continuity.css';
import './public-club.css';

export default function Summit() {
 const [arrived,setArrived]=useState(false);
 function navigate(id:string){window.dispatchEvent(new CustomEvent('summit:navigate',{detail:id}));}
 function enter(e:MouseEvent<HTMLAnchorElement>){e.preventDefault();navigate('basecamp');}
 useEffect(()=>{
  // Older shared links now lead to the separate member page.
  if(['#expeditions','#board','#calendar','#club','#trail-community','#trail-photos'].includes(location.hash))navigate('join');
 },[]);
 return <><a className="skip" href="#basecamp" onClick={enter}>Skip to the club</a>
  <header className="masthead journey-nav public-masthead" data-arrived={arrived}>
   <a href="#home" className="wordmark" aria-label="SUMMIT home"><SummitMark motion="entrance" active={arrived}/><SummitWordmark/><span>CATHEDRAL CATHOLIC<br/>OUTDOOR CLUB</span></a>
   <nav><a href="#basecamp" onClick={enter}>The club</a><Link href="/register/?mode=signin">Log in</Link></nav>
   <a className="join-nav" href="#join" onClick={e=>{e.preventDefault();navigate('join');}}>Join SUMMIT<ArrowUpRight size={17}/></a>
  </header>
  <main><SummitExperience onJoin={()=>navigate('join')} onReveal={setArrived}>
   <ForestStory brandActive={arrived} onJoin={()=>navigate('join')} compact/>
   <section className="public-signup" id="join" aria-label="Join the club"><Registration embedded/></section>
  </SummitExperience></main>
  <footer className="club-footer"><a className="wordmark" href="#home" aria-label="SUMMIT home"><SummitMark/><SummitWordmark/></a><Link href="/members/">Member basecamp</Link><Link href="/leadership/">Club leadership</Link><p>Cathedral Catholic High School<br/><small>Founder &amp; President: Tobias Kell</small></p></footer>
 </>;
}
