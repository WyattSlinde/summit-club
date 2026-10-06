import { Footprints, Users, CalendarDays } from 'lucide-react';
import './first-outing.css';

export default function FirstOuting() {
  return <section className="first-outing section" aria-labelledby="first-outing-title">
    <div className="first-outing-heading"><span>BEFORE YOUR FIRST OUTING</span><h2 id="first-outing-title">Everyone starts somewhere.</h2></div>
    <div className="first-outing-answers">
      <article><Footprints size={22} strokeWidth={1.4} aria-hidden="true"/><h3>Come as you are.</h3><p>Every Cathedral Catholic student is welcome. No hiking, outdoor, or athletic experience required.</p></article>
      <article><Users size={22} strokeWidth={1.4} aria-hidden="true"/><h3>Find your crew.</h3><p>Register your interest, help choose an outing, and bring your ideas. Joining records your interest; each outing has its own RSVP.</p></article>
      <article><CalendarDays size={22} strokeWidth={1.4} aria-hidden="true"/><h3>Check the plan.</h3><p>Before RSVPing, check the confirmed event for its date, meeting point, and required permissions. Questions? Ask Tobias Kell at school.</p></article>
    </div>
  </section>;
}
