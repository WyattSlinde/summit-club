'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy } from 'lucide-react';
import { cloudClient, clubRequest } from '@/lib/cloud-client';
import { type BasecampState } from '@/lib/basecamp-client';
import MemberAuth, { MemberSignOut } from '../member-auth';
import LeaderDesk from '../leader-desk';
import { SummitMark, SummitWordmark } from '../summit-brand';
import '../profile/profile.css';
export default function CloudLeadership() {
  const [state, setState] = useState<BasecampState | null>(null), [id, setId] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState(''), [open, setOpen] = useState(false);
  const load = useCallback(async () => { setError(''); try { const result = await clubRequest<BasecampState>('basecamp'); const { data } = await cloudClient().auth.getUser(); setState(result); setId(data.user?.id || ''); } catch(e) { setError(e instanceof Error ? e.message : 'Could not connect.'); } }, []);
  // Load external account authorization after hydration.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);
  return <main className="member-page"><header className="member-header"><Link href="/#basecamp" className="member-brand"><SummitMark/><SummitWordmark/></Link><Link href="/#basecamp"><ArrowLeft size={15}/> The club</Link></header><div className="member-shell"><section className="member-onboarding"><div><span className="member-kicker">FOR THE PEOPLE MAKING IT HAPPEN</span><h1>Club leadership.</h1><p>Registrations, ideas, votes, and event planning. One place to keep your crew moving.</p><Link href="/profile/" className="member-text">My profile</Link></div><div>{!state ? <p role="status">{error || 'Connecting…'}</p> : !state.signedIn ? <MemberAuth onSignedIn={() => void load()}/> : state.leader ? <><h2>Welcome back.</h2><p>Your leadership desk is ready.</p><button className="member-primary" onClick={() => setOpen(true)}>Open leadership desk</button></> : <><h2>You’re signed in.</h2><p className="member-fine">This account hasn’t been granted leadership access. Give your account code to the site owner to be approved.</p><label className="member-form">Your account code<input readOnly value={id} onFocus={e => e.currentTarget.select()}/></label><button className="member-text" onClick={async () => { try { await navigator.clipboard.writeText(id); setNotice('Account code copied.'); } catch { setError('Select the code and copy it manually.'); } }}><Copy size={15}/> Copy account code</button></>}{state?.signedIn && <MemberSignOut onDone={() => void load()}/>}<button className="member-text" onClick={() => void load()}>Refresh access</button>{notice && <p role="status">{notice}</p>}{error && <p className="member-error" role="alert">{error}</p>}</div></section></div><LeaderDesk open={open && !!state?.leader} onOpenChange={setOpen} onChanged={() => void load()}/></main>;
}
