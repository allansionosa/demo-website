import { ChevronDown, ShieldCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';

export function OnlinePortalMenu({ signedIn }: { signedIn: boolean }) {
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (event.target instanceof Node && !menu.current?.contains(event.target) && menu.current) menu.current.open = false;
    };
    document.addEventListener('pointerdown', closeOutside);
    return () => document.removeEventListener('pointerdown', closeOutside);
  }, []);
  return <details ref={menu} className="online-portal-menu" onKeyDown={(event) => {
    if (event.key === 'Escape' && menu.current) { menu.current.open = false; menu.current.querySelector('summary')?.focus(); }
  }}>
    <summary className="online-portal-toggle" aria-label="Online Portal"><ShieldCheck size={16} aria-hidden="true" /><span>Online Portal</span><ChevronDown size={15} aria-hidden="true" /></summary>
    <nav className="online-portal-options" aria-label="Online portals" onClick={() => { if (menu.current) menu.current.open = false; }}>
      <a href={signedIn ? '#/dashboard' : '#/portal'}><strong>Patient Portal</strong><small>Appointments, results and bills</small></a>
      <a href="#/doctor-portal"><strong>Doctor Portal</strong><small>Separate access for doctors</small></a>
    </nav>
  </details>;
}

export function DoctorPortalEntry() {
  return <section className="clinic-container doctor-portal-entry">
    <div><p className="eyebrow">Online Portal</p><h1>Doctor Portal</h1><p>A separate sign-in for doctors.</p></div>
    <section className="card doctor-sign-in" aria-labelledby="doctor-sign-in-title">
      <h2 id="doctor-sign-in-title">Doctor sign in</h2>
      <p role="status">Doctor sign-in is not available yet. Please contact the clinic for access.</p>
      <fieldset disabled><label className="field">Doctor ID<input autoComplete="username" /></label><label className="field">Password<input type="password" autoComplete="current-password" /></label><button className="button button-primary" type="button">Sign in</button></fieldset>
      <a href="#/portal" className="clinic-text-link">Looking for the Patient Portal?</a>
    </section>
  </section>;
}
