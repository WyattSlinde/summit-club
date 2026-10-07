'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy } from 'lucide-react';
import { cloudClient, clubRequest } from '@/lib/cloud-client';
import { type BasecampState } from '@/lib/basecamp-client';
import MemberAuth, { MemberSignOut } from '../member-auth';
import LeaderDesk from '../leader-desk';
import { SummitMark, SummitWordmark } from '../summit-brand';
import '../profile/profile.css';
export default function CloudLeadership() {
  const [state, setState] = useState<BasecampState | null>(null), [id, setId] = useState(''), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const requests = useRef(0), accountId = useRef<string | null>(null);
  const load = useCallback(async () => {
    const version = ++requests.current; setError('');
    try {
      const { data, error: authError } = await cloudClient().auth.getUser();
      if (authError && data.user) throw authError;
      const result = await clubRequest<BasecampState>('basecamp');
      if (version === requests.current) { accountId.current = data.user?.id || null; setState(result); setId(data.user?.id || ''); }
    } catch(e) { if (version === requests.current) { setState(null); setId(''); setError(e instanceof Error ? e.message : 'Could not connect.'); } }
  }, []);
  useEffect(() => {
    let disposed = false;
    const reads = requests, frame = requestAnimationFrame(() => void load());
    const { data } = cloudClient().auth.onAuthStateChange((event, session) => {
      const nextAccount = session?.user.id || null;
      if (event === 'INITIAL_SESSION') accountId.current = nextAccount;
      if (event === 'SIGNED_OUT' || (event === 'SIGNED_IN' && nextAccount !== accountId.current)) {
        accountId.current = nextAccount; reads.current++; setState(null); setId('');
        queueMicrotask(() => { if (!disposed) void load(); });
      }
    });
    return () => { disposed = true; cancelAnimationFrame(frame); reads.current++; data.subscription.unsubscribe(); };
  }, [load]);
  return <main className="member-page leadership-page">
    <header className="member-header"><Link href="/#home" className="member-brand" aria-label="SUMMIT home"><SummitMark/><SummitWordmark/></Link><Link href={state?.member ? '/members/' : '/#basecamp'}><ArrowLeft size={15}/>{state?.member ? 'Member basecamp' : 'The club'}</Link></header>
    <div className="leadership-shell">
      {state?.leader ? <><LeaderDesk open inline onChanged={() => void load()}/><div className="leadership-account"><span>SUMMIT · Cathedral Catholic High School</span><div><Link href="/profile/" className="member-text">My profile</Link><MemberSignOut onDone={() => void load()}/></div></div></> : <section className="member-onboarding"><div><span className="member-kicker">FOR THE PEOPLE MAKING IT HAPPEN</span><h1>Club leadership.</h1><p>Registrations, ideas, votes, and event planning. One place to keep your crew moving.</p></div><div>
        {!state ? <p role="status">{error || 'Connecting…'}</p> : !state.signedIn ? <MemberAuth onSignedIn={() => void load()}/> : <><h2>You’re signed in.</h2><p className="member-fine">This account hasn’t been granted leadership access. Give your account code to the site owner to be approved.</p><label className="member-form">Your account code<input readOnly value={id} onFocus={e => e.currentTarget.select()}/></label><button className="member-text" onClick={async () => { try { await navigator.clipboard.writeText(id); setNotice('Account code copied.'); } catch { setError('Select the code and copy it manually.'); } }}><Copy size={15}/> Copy account code</button></>}
        {state?.signedIn && <MemberSignOut onDone={() => void load()}/>}<button className="member-text" onClick={() => void load()}>Refresh access</button>{notice && <p role="status">{notice}</p>}{error && <p className="member-error" role="alert">{error}</p>}
      </div></section>}
    </div>
  </main>;
}
