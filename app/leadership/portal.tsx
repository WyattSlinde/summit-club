'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check } from 'lucide-react';
import LeaderDesk from '../leader-desk';
import '../forest-continuity.css';
import './portal.css';
import { SummitMark, SummitWordmark } from '../summit-brand';

type Account = { name: string; code: string; leader: boolean };
export default function LeadershipPortal({ account, signInHref, signOutHref, localPreview, previewOnly = false }: {
  account: Account | null; signInHref: string; signOutHref: string; localPreview: boolean; previewOnly?: boolean;
}) {
  const [open, setOpen] = useState(!!account?.leader), [copied, setCopied] = useState(false), [error, setError] = useState('');
  async function copyCode() {
    if (!account) return;
    try { await navigator.clipboard.writeText(account.code); setCopied(true); setError(''); }
    catch { setError('Select the account code below and copy it.'); }
  }
  return <main className="leadership-portal">
    <header><Link href="/#basecamp" className="portal-brand" aria-label="SUMMIT home"><SummitMark/><SummitWordmark/></Link><Link href="/#basecamp" className="portal-back"><ArrowLeft size={16}/> Back to the club</Link></header>
    <div className="portal-body"><div className="portal-intro"><p>FOR THE PEOPLE MAKING IT HAPPEN</p><h1>Club<br/>leadership.</h1><span>Bring the crew together.<br/>Plan what’s next.</span></div>
      <section className="portal-panel" aria-label="Leadership access">
        {previewOnly ? <><span className="portal-label">WEBSITE PREVIEW</span><h2>The crew comes next.</h2><p>Leadership access, registrations, and voting will open once the live club backend is connected. This preview contains no student records.</p><Link className="portal-button" href="/#basecamp">Back to the club</Link></> : !account ? <><span className="portal-label">SIGN IN</span><h2>Your club, in one place.</h2><p>View registrations, student ideas, outing votes, and event RSVPs.</p><a href={signInHref} target="_top" className="portal-button">Sign in with ChatGPT</a><p className="portal-small">The leadership desk is available to approved club leaders.</p></>
          : account.leader ? <><span className="portal-label">LEADERSHIP ACCESS</span><h2>Welcome back.</h2><p>Signed in as {account.name}.</p><button className="portal-button" onClick={() => setOpen(true)}>Open leadership desk</button><p className="portal-small">Member records and student suggestions stay private to club leadership.</p></>
          : <><span className="portal-label">ACCESS SETUP</span><h2>You’re signed in.</h2><p>This account hasn’t been added to club leadership yet. Send your account code to the site owner so they can grant access.</p><label className="portal-code">Your account code<input value={account.code} readOnly onFocus={event => event.currentTarget.select()}/></label><button className="portal-button" onClick={copyCode}>{copied ? <Check size={17}/> : <Copy size={17}/>} {copied ? 'Account code copied' : 'Copy account code'}</button><p className="portal-small">After access is granted, <button className="portal-inline" onClick={() => location.reload()}>check again</button>.</p>{error && <p role="alert" className="portal-small">{error}</p>}</>}
        {account && <a className="portal-signout" href={signOutHref} target="_top">Sign out or use another account</a>}
        {localPreview && <p className="portal-local">Local preview uses a demo account. Hosted leadership access is configured separately.</p>}
      </section>
    </div>
    {account?.leader && <LeaderDesk open={open} onOpenChange={setOpen} onChanged={() => undefined}/>}
    <footer>Cathedral Catholic High School · Explore. Serve. Lead.</footer>
  </main>;
}
