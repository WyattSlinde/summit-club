'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, Loader2, Mail } from 'lucide-react';
import { cloudClient, cloudAuthReady, announceMemberChange, signOutMember } from '@/lib/cloud-client';
import { sitePath } from '@/lib/site-path';

type Mode = 'signin' | 'signup' | 'reset' | 'password';
export function MemberSignOut({ onDone }: { onDone?: () => void }) {
  const [error, setError] = useState(''), [busy, setBusy] = useState(false);
  return <><button className="text-button member-text" disabled={busy} onClick={async () => { setBusy(true); setError(''); try { await signOutMember(); onDone?.(); } catch (e) { setError(e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } }}>{busy ? 'Signing out…' : 'Sign out'}</button>{error && <p role="alert">{error}</p>}</>;
}
export default function MemberAuth({ onSignedIn }: { onSignedIn: () => void }) {
  const [mode, setMode] = useState<Mode>(typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('recovery') === '1' ? 'password' : 'signin'), [email, setEmail] = useState(''), [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  useEffect(() => {
    const { data } = cloudClient().auth.onAuthStateChange(event => {
      if (event === 'PASSWORD_RECOVERY') { setMode('password'); setNotice('Choose a new password for your account.'); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  function choose(next: Mode) { setMode(next); setError(''); setNotice(''); setPassword(''); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (busy) return; setBusy(true); setError(''); setNotice('');
    const client = cloudClient(), redirect = new URL(sitePath('/profile/'), location.origin).href;
    try {
      if (mode === 'signup') {
        const result = await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: redirect } });
        if (result.error) throw result.error;
        if (result.data.session) { announceMemberChange(); onSignedIn(); }
        else { setNotice('Check your email for a confirmation link. Then come back and sign in. If you already have an account, sign in or reset your password.'); setMode('signin'); setPassword(''); }
      } else if (mode === 'signin') {
        const result = await client.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        announceMemberChange(); onSignedIn();
      } else if (mode === 'reset') {
        const result = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: redirect + '?recovery=1' });
        if (result.error) throw result.error;
        setNotice('If there’s an account for this email, you’ll receive a password reset link.');
      } else {
        const result = await client.auth.updateUser({ password });
        if (result.error) throw result.error;
        setNotice('Password updated. You can continue to your profile.'); setPassword(''); announceMemberChange(); onSignedIn();
        history.replaceState(null, '', sitePath('/profile/'));
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not sign in. Please try again.'); }
    finally { setBusy(false); }
  }
  async function resendConfirmation() {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setError('Enter your email first.'); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      const { error } = await cloudClient().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: new URL(sitePath('/profile/'), location.origin).href } });
      if (error) throw error;
      setNotice('If this account needs confirmation, a new link will arrive by email.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not send the link. Try again.'); }
    finally { setBusy(false); }
  }
  if (!cloudAuthReady) return <div className="member-empty"><Mail size={26}/><h2>Member accounts are coming online.</h2><p>Email sign-in is being connected. No account details are collected until it’s ready.</p></div>;
  return <div className="member-auth"><div className="member-auth-tabs" aria-label="Account options"><button disabled={busy} aria-pressed={mode === 'signin'} onClick={() => choose('signin')}>Sign in</button><button disabled={busy} aria-pressed={mode === 'signup'} onClick={() => choose('signup')}>Create account</button></div><h2>{mode === 'signup' ? 'Find your people.' : mode === 'reset' ? 'Let’s get you back in.' : mode === 'password' ? 'A fresh password.' : 'Back with the crew.'}</h2><p>{mode === 'signup' ? 'One account for your profile, friends, outing votes, and club registration.' : 'Your profile and connections stay with you on every device.'}</p><form className="member-form" onSubmit={submit}>
    {mode !== 'password' && <label>Email<input type="email" autoComplete="email" required value={email} maxLength={254} onChange={e => setEmail(e.target.value)} disabled={busy}/></label>}
    {mode !== 'reset' && <label>Password<input type="password" autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required minLength={mode === 'signin' ? 1 : 12} maxLength={128} value={password} onChange={e => setPassword(e.target.value)} disabled={busy}/>{mode !== 'signin' && <small>Use at least 12 characters.</small>}</label>}
    <button className="member-primary" disabled={busy}>{busy ? <Loader2 className="spin" size={17}/> : <ArrowUpRight size={17}/>} {busy ? 'One moment…' : mode === 'signup' ? 'Create my account' : mode === 'reset' ? 'Send reset link' : mode === 'password' ? 'Save password' : 'Sign in'}</button>
  </form>{mode === 'signin' && <div className="member-auth-help"><button className="member-text" disabled={busy} onClick={() => choose('reset')}>Forgot your password?</button><button className="member-text" disabled={busy} onClick={() => void resendConfirmation()}>Resend confirmation</button></div>}{mode === 'signup' && <p className="member-fine">For Cathedral Catholic students. Your email stays private. Creating an account does not register you for an outing.</p>}{error && <p className="member-error" role="alert">{error}</p>}{notice && <p className="member-notice" role="status">{notice}</p>}</div>;
}
