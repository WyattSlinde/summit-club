'use client';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowUpRight, Loader2, Mail } from 'lucide-react';
import { basecampRequest, type BasecampState, type Member } from '@/lib/basecamp-client';
import { cloudClient, cloudConfigured, cloudAuthReady, announceMemberChange } from '@/lib/cloud-client';
import { registrationDetails, type RegistrationDetails } from '@/lib/club-registration';
import { sitePath } from '@/lib/site-path';
import { SummitMark, SummitWordmark } from '../summit-brand';
import MemberAuth, { MemberSignOut } from '../member-auth';
import './registration.css';
import '../public-club.css';
import '../profile/profile.css';

type Props = { embedded?: boolean; signInHref?: string; signOutHref?: string; localPreview?: boolean };
export default function Registration({ embedded = false }: Props) {
  const router = useRouter();
  const [account, setAccount] = useState<BasecampState | null>(null), [email, setEmail] = useState('');
  const [loading, setLoading] = useState(cloudConfigured), [saving, setSaving] = useState(false);
  const [mode, setMode] = useState<'signup'|'signin'>('signup'), [editing, setEditing] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [confirmation, setConfirmation] = useState(false);
  const [draft, setDraft] = useState<RegistrationDetails | null>(null);
  const submitting = useRef(false), version = useRef(0);
  const goToMembers = useCallback(() => router.replace('/members/'), [router]);
  async function saveDetails(details: RegistrationDetails) {
    await basecampRequest<{ saved: true; member: Member }>({ method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({action:'join', ...details}) });
    // The pending fields are form data only, never authorization claims.
    await cloudClient().auth.updateUser({ data:{ summit_registration:null } });
    announceMemberChange(); goToMembers();
  }
  const load = useCallback(async () => {
    if (!cloudConfigured || submitting.current) return;
    const current=++version.current; setLoading(true); setError('');
    try {
      const state=await basecampRequest<BasecampState>();
      if(current!==version.current)return;
      setAccount(state);
      if(state.member && !new URLSearchParams(location.search).has('edit')) { if(!embedded)goToMembers(); return; }
      if(state.signedIn) {
        const {data,error:authError}=await cloudClient().auth.getUser();
        if(authError)throw new Error('Could not check your account. Please sign in again.');
        if(current!==version.current)return;
        setEmail(data.user?.email || '');
        const pending=registrationDetails(data.user?.user_metadata?.summit_registration);
        if(pending)setDraft(pending);
        if(pending && !state.member && data.user?.email_confirmed_at && new URLSearchParams(location.search).get('complete')==='1') {
          submitting.current=true;setSaving(true);
          try {
            await basecampRequest({method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'join',...pending})});
            await cloudClient().auth.updateUser({data:{summit_registration:null}});
            announceMemberChange();goToMembers();
          } finally {submitting.current=false;setSaving(false);}
        }
      }
    } catch(e){if(current===version.current)setError(e instanceof Error?e.message:'Could not check registration. Try again.');}
    finally{if(current===version.current)setLoading(false);}
  },[goToMembers,embedded]);
  useEffect(()=>{
    const reads=version;
    const params=new URLSearchParams(location.search);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMode(params.get('mode')==='signin'?'signin':'signup');setEditing(params.has('edit'));void load();
    const refresh=()=>void load(); window.addEventListener('summit:member-change',refresh);
    return()=>{reads.current++;window.removeEventListener('summit:member-change',refresh);};
  },[load]);
  async function register(event:FormEvent<HTMLFormElement>){
    event.preventDefault();if(submitting.current||!cloudAuthReady)return;
    const form=new FormData(event.currentTarget);
    const details=registrationDetails({name:form.get('name'),grade:form.get('grade'),interest:form.get('interest'),note:form.get('note')||'',consent:form.get('consent')==='on'});
    if(!details){setError('Add your name, grade, interests, and registration consent.');return;}
    submitting.current=true;version.current++;setSaving(true);setError('');setNotice('');
    try {
      if(account?.signedIn){await saveDetails(details);return;}
      const signupEmail=String(form.get('email')||'').trim();setEmail(signupEmail);
      const {data,error:signupError}=await cloudClient().auth.signUp({email:signupEmail,password:String(form.get('password')||''),options:{emailRedirectTo:new URL(sitePath('/register/?complete=1'),location.origin).href,data:{summit_registration:details}}});
      if(signupError)throw signupError;
      if(data.session){setAccount(await basecampRequest<BasecampState>());await saveDetails(details);}
      else{setConfirmation(true);setNotice('Open the confirmation link in your email to finish joining and enter member basecamp. If you already have an account, sign in below.');}
    } catch(e){setError(e instanceof Error?e.message:'Could not register. Your input is still here.');}
    finally{submitting.current=false;setSaving(false);}
  }
  async function resend(){
    if(saving)return;setSaving(true);setError('');
    try{const {error}=await cloudClient().auth.resend({type:'signup',email,options:{emailRedirectTo:new URL(sitePath('/register/?complete=1'),location.origin).href}});if(error)throw error;setNotice('If confirmation is needed, a new link will arrive by email.');}
    catch(e){setError(e instanceof Error?e.message:'Could not resend. Try again.');}finally{setSaving(false);}
  }
  const Tag=embedded?'div':'main', Heading=embedded?'h2':'h1';
  const disabled=saving||loading||!cloudAuthReady;
  return <Tag className={`registration-page ${embedded?'registration-embedded':''}`}>
    {!embedded&&<header className="registration-header"><Link href="/#home" className="registration-brand" aria-label="SUMMIT home"><SummitMark/><SummitWordmark/></Link><Link href="/#home" className="registration-back"><ArrowLeft size={16}/> Replay the mountain intro</Link></header>}
    <div className="registration-layout">
      <aside className="signup-welcome"><span>EXPLORE. SERVE. LEAD.</span><h2>Your next adventure<br/>starts with the crew.</h2><p>Hike somewhere new. Give back along the way. Meet people who are up for it.</p><ul><li>Open to every Cathedral Catholic student</li><li>No outdoor experience needed</li><li>Student-led, from the first idea to the trail</li></ul><p className="signup-leader">Led by Tobias Kell<br/><a href="mailto:Tkell2028@cchsdons.com">Tkell2028@cchsdons.com</a></p></aside>
      <section className="registration-panel" aria-labelledby="registration-title" aria-busy={loading||saving}>
        <span className="registration-status">{editing?'YOUR REGISTRATION':mode==='signin'?'WELCOME BACK':'JOIN THE CLUB'}</span>
        <Heading id="registration-title">{account?.member&&!editing?'You’re in.':confirmation?'Check your inbox.':editing?'Make it yours.':mode==='signin'?'Back to basecamp.':'You belong out here.'}</Heading>
        {loading?<p role="status" className="registration-loading"><Loader2 className="spin" size={18}/> Checking your registration…</p>
        :account?.member&&!editing?<><p className="registration-intro">Your member basecamp is ready. Choose an outing, find friends, and share what you’ve been up to.</p><Link className="registration-primary" href="/members/">Open member basecamp<ArrowUpRight size={17}/></Link><Link className="registration-secondary" href="/register/?edit=1">Edit registration</Link></>
        :mode==='signin'&&!account?.signedIn&&cloudConfigured?<MemberAuth onSignedIn={()=>void load()}/>
        :confirmation?<div className="registration-confirmation"><Mail size={28}/><p className="registration-intro">We’ve requested a confirmation link for <strong>{email}</strong>. Confirming your email finishes registration securely.</p><button className="registration-secondary" disabled={saving} onClick={()=>void resend()}>Resend confirmation</button></div>
        :<form className="registration-form" onSubmit={register}>
          {!cloudAuthReady&&<p className="registration-availability" role="status">Online signup is being connected. This form will open when it’s ready. You can contact Tobias above in the meantime.</p>}
          <label>Your name<input name="name" autoComplete="name" required minLength={2} maxLength={70} defaultValue={account?.member?.name||draft?.name||''} placeholder="First and last name" disabled={disabled}/></label>
          {!account?.signedIn&&<><label>Email<input name="email" type="email" autoComplete="email" required maxLength={254} placeholder="you@cchsdons.com" disabled={disabled}/></label><label>Create a password<input name="password" type="password" autoComplete="new-password" required minLength={12} maxLength={128} disabled={disabled}/><small>At least 12 characters. Your password is never shared with club leaders.</small></label></>}
          {account?.signedIn&&<p className="registration-fine">{!account.member?'Email confirmed. Add your details below to join the club. ':''}Signed in as {email}</p>}
          <div className="registration-fields"><label>Grade<select name="grade" required defaultValue={account?.member?.grade||draft?.grade||''} disabled={disabled}><option value="" disabled>Choose grade</option>{['9','10','11','12'].map(g=><option value={g} key={g}>Grade {g}</option>)}</select></label><label>I’m here for<select name="interest" defaultValue={account?.member?.interest||draft?.interest||'All of it'} disabled={disabled}>{['Explore','Serve','Lead','All of it'].map(i=><option key={i}>{i}</option>)}</select></label></div>
          <label>What would you love to do? <small>Optional</small><textarea name="note" rows={3} maxLength={400} defaultValue={account?.member?.note||draft?.note||''} placeholder="A sunrise hike, a beach cleanup, something new…" disabled={disabled}/></label>
          <label className="registration-consent"><input type="checkbox" name="consent" required defaultChecked={!!draft?.consent} disabled={disabled}/><span>I’m a Cathedral Catholic student. I agree to save my registration and share my name, email, grade, interests, and note with club leadership, including an email to Tobias Kell at Tkell2028@cchsdons.com.</span></label>
          <button className="registration-primary" disabled={disabled}>{saving?<><Loader2 className="spin" size={18}/> Joining…</>:!cloudAuthReady?'Signup opens soon':editing?'Save & return to basecamp':account?.signedIn?'Join & enter basecamp':'Join SUMMIT'}<ArrowUpRight size={17}/></button>
          <p className="registration-fine">After joining: your profile, friends, outing votes, top hikes, and club photos. Each outing has its own RSVP.</p>
        </form>}
        {!account?.signedIn&&<button type="button" className="registration-secondary" disabled={saving||!cloudAuthReady} onClick={()=>{setMode(mode==='signin'?'signup':'signin');setConfirmation(false);setNotice('');setError('');}}>{mode==='signin'?'New here? Join the club':'Already a member? Sign in'}</button>}
        {error&&<p className="registration-error" role="alert">{error}</p>}{notice&&<p className="registration-saved" role="status">{notice}</p>}
        {account?.signedIn&&<MemberSignOut onDone={()=>void load()}/>}
      </section>
    </div>
    {!embedded&&<footer>SUMMIT · Cathedral Catholic High School<span>Explore. Serve. Lead.</span></footer>}
  </Tag>;
}
