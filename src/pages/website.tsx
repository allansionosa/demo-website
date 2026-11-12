import { ArrowDown, ArrowRight, ArrowUpRight, CalendarDays, Check, CheckCircle2, Clock3, FlaskConical, Heart, HeartPulse, MapPin, Menu, MessageCircle, ScanLine, Search, ShieldCheck, Stethoscope, Users, X } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { demoServices, relativeDate, saveDemoBooking } from '../demo';
import { money, longDate } from '../format';
import { clinicToday } from '../record-tools';
import { Modal } from '../components/modal';
import { Alert, Field } from '../components/shared';
import type { Appointment } from '../types';
import { ClinicHome } from '../components/clinic-home';
import '../website.css';

const doctors = [
  { name: 'Dr. Maya Reyes', initials: 'MR', specialty: 'Primary care', service: 101, color: 'mint', bio: 'The sample primary care profile demonstrates how patients can explore a clinician’s focus before booking.', focus: 'Everyday health concerns and follow-up visits', days: 'Monday, Wednesday, Friday' },
  { name: 'Dr. Daniel Cruz', initials: 'DC', specialty: 'Cardiology', service: 104, color: 'sand', bio: 'The sample cardiology profile connects a specialist directory to the demo heart health consultation.', focus: 'Heart health consultations', days: 'Tuesday and Thursday' },
  { name: 'Dr. Sofia Lim', initials: 'SL', specialty: 'Pediatrics', service: 105, color: 'blue', bio: 'The sample pediatric profile shows how families can explore care options for a child.', focus: 'Children’s health consultations', days: 'Monday, Tuesday, Saturday' },
];
const faqs = [
  { q: 'How do I try the patient portal?', a: 'Choose “Explore demo portal” to enter as Alex Santos, a fictional patient. You can view visits, open and download sample reports, explore billing, and try a sample booking. No registration or real patient details are needed.' },
  { q: 'Does a demo booking reserve a real appointment?', a: 'No. Demo bookings are saved only in this browser tab and do not reach a clinic, send email, or collect payment. A visit date is for demonstration and does not reserve a time slot.' },
  { q: 'How do existing patients sign in?', a: 'Choose “Clinic patient sign in” on the portal sign-in page. Use the patient number and password supplied by the clinic. That flow uses the existing appointment system and requires its backend to be available.' },
  { q: 'Can I see my diagnostic results online?', a: 'The patient portal displays released and validated results only. In this demo, the laboratory and imaging reports contain fictional sample data and must not be used for medical decisions.' },
  { q: 'Can I book for someone else?', a: 'Yes, in the demo booking form choose “Someone else”. Their details remain separate from Alex’s registered profile, and the sample visit will not appear in Alex’s personal appointment list.' },
  { q: 'Can I pay my bill on this website?', a: 'Billing shows charges, recorded payments, and outstanding balances. Online payment is not connected. No money is collected by this demo.' },
  { q: 'Should I prepare before a test?', a: 'Ask the clinic for preparation instructions for your specific booked examination. This demo does not provide fasting or other medical preparation instructions.' },
];

function ServiceIcon({ name, size = 25 }: { name: string; size?: number }) {
  const Icon = name === 'lab' ? FlaskConical : name === 'imaging' ? ScanLine : name === 'heart' ? HeartPulse : name === 'child' ? Users : Stethoscope;
  return <Icon size={size} strokeWidth={1.6} />;
}

function Brand() {
  return <a href="#/home" className="brand clinic-brand" aria-label="HIMS Clinic home"><span className="brand-mark"><HeartPulse size={25} /></span><span><strong>HIMS<span className="brand-dot">.</span></strong><small>Clinic & diagnostics</small></span></a>;
}

export function Website({ route, signedIn, onDemo, onBook }: { route: string; signedIn: boolean; onDemo: () => void; onBook: (service?: number) => void }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const content = useRef<HTMLElement>(null);
  const previousRoute = useRef(route);
  useEffect(() => {
    document.title = `${route === 'home' ? 'Care that fits your life' : route.charAt(0).toUpperCase() + route.slice(1)} | HIMS Demo Clinic`;
    if (previousRoute.current !== route) {
      previousRoute.current = route;
      window.scrollTo({ top: 0, behavior: 'instant' });
      content.current?.focus({ preventScroll: true });
    }
  }, [route]);
  return <div className="clinic-site">
    <a className="clinic-skip" href="#clinic-content" onClick={(event) => { event.preventDefault(); content.current?.focus(); }}>Skip to content</a>
    <header className="clinic-header">
      <div className="clinic-container clinic-header-inner">
        <Brand />
        <nav className={`clinic-nav ${menuOpen ? 'clinic-nav-open' : ''}`} aria-label="Main navigation" id="clinic-navigation" onClick={() => setMenuOpen(false)} onKeyDown={(event) => { if (event.key === 'Escape') { setMenuOpen(false); document.getElementById('clinic-menu-toggle')?.focus(); } }}>
          {[['home', 'Home'], ['services', 'Our services'], ['doctors', 'Our doctors'], ['about', 'About us'], ['contact', 'Contact']].map(([value, label]) => <a key={value} href={`#/${value}`} aria-current={route === value ? 'page' : undefined}>{label}</a>)}
        </nav>
        <div className="clinic-header-actions"><a href={signedIn ? '#/dashboard' : '#/portal'} className="clinic-portal-link" aria-label="Patient portal"><ShieldCheck size={16} /><span>Patient portal</span></a><button className="clinic-button clinic-button-dark clinic-header-book" onClick={() => onBook()}>Book a visit <ArrowUpRight size={16} /></button><button id="clinic-menu-toggle" className="icon-button clinic-menu-toggle" aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="clinic-navigation" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X /> : <Menu />}</button></div>
      </div>
    </header>
    <main ref={content} id="clinic-content" tabIndex={-1}>
      {route === 'home' && <ClinicHome onDemo={onDemo} onBook={onBook}>
        <section className="clinic-container clinic-section" aria-labelledby="clinic-team-title">
          <div className="clinic-section-heading"><h2 id="clinic-team-title" data-clinic-reveal>Meet the care team.</h2></div>
          <p className="clinic-team-intro">Three fictional clinicians. Explore their focus and try a related service booking.</p>
          <DoctorDirectory compact onBook={onBook} />
          <a href="#/doctors" className="clinic-text-link clinic-team-link">Explore the profiles <ArrowUpRight size={18} /></a>
        </section>
        <section className="clinic-container clinic-steps" aria-labelledby="clinic-steps-title"><div data-clinic-reveal><h2 id="clinic-steps-title">A simpler next step.</h2><button className="clinic-text-link" onClick={() => onBook()}>Plan a demo visit <ArrowRight size={18} /></button></div><ol>{[['Find your care', 'Explore consultations and diagnostic services.'], ['Choose your visit date', 'Try a sample booking for yourself or someone else.'], ['Keep your care together', 'See your own sample visit in the demo patient portal.']].map(([title, copy]) => <li key={title} data-clinic-reveal><Check size={18} /><div><h3>{title}</h3><p>{copy}</p></div></li>)}</ol></section>
        <section className="clinic-container clinic-section clinic-faq-home" aria-labelledby="clinic-faq-title"><div data-clinic-reveal><h2 id="clinic-faq-title">Before you begin.</h2><a className="clinic-text-link" href="#/faq">All questions <ArrowUpRight size={18} /></a></div><FaqList limit={3} /></section>
      </ClinicHome>}
      {route === 'services' && <><PageIntro eyebrow="OUR SERVICES" title="Find your care." copy="Explore sample consultations and diagnostics, then try a visit booking. All services, availability, and fees on this website are illustrative." /><ServiceDirectory onBook={onBook} /></>}
      {route === 'doctors' && <><PageIntro eyebrow="OUR DEMO CARE TEAM" title="Meet the care team." copy="Meet fictional clinicians created for this demonstration. Explore their sample profiles and choose a service to try the booking experience." /><section className="clinic-container clinic-section clinic-directory-section"><DoctorDirectory onBook={onBook} /></section></>}
      {route === 'about' && <><PageIntro eyebrow="ABOUT THIS CLINIC DEMO" title="Care that stays connected." copy="HIMS Demo Clinic brings a public clinic website and a patient portal into one experience, showing what a simpler patient journey can feel like." /><section className="clinic-container clinic-about-grid clinic-section"><figure className="clinic-about-illustration"><img src="/images/clinic-concept.webp" width="1536" height="1024" alt="Illustrative clinic interior with blue seating and natural daylight" /><figcaption>Illustrative clinic interior</figcaption></figure><div><h2>From finding care<br />to following through.</h2><p>This project demonstrates the journey from browsing services to planning a visit, viewing released diagnostic reports, and understanding billing.</p><p>The demo uses a fictional clinic, fictional doctors, and a sample patient. Existing clinic patients can still use the original secure sign-in and connected appointment system when those services are configured.</p><a href="#/portal" className="clinic-button clinic-button-dark">Visit the patient portal <ArrowUpRight size={18} /></a></div></section><section className="clinic-container clinic-value-grid">{[[Heart, 'Personal', 'A clear distinction between your own care and bookings for someone else.'], [ShieldCheck, 'Considered', 'Released reports and patient-specific records in the connected portal.'], [CalendarDays, 'Connected', 'An experience that brings visit planning and follow-up together.']].map(([Icon, title, copy]) => typeof Icon !== 'string' && <article key={String(title)}><Icon size={28} /><h3>{String(title)}</h3><p>{String(copy)}</p></article>)}</section></>}
      {route === 'contact' && <><PageIntro eyebrow="LET’S CONNECT" title="Let’s talk." copy="Try the contact form or find answers to common questions. This is a demonstration; messages are not delivered to a clinic." /><ContactPage /></>}
      {route === 'faq' && <><PageIntro eyebrow="PATIENT GUIDE" title="Before your visit." copy="Answers about the demo website, appointments, patient access, and reports." /><section className="clinic-container clinic-section clinic-faq-page"><FaqList /></section></>}
      {route === 'privacy' && <><PageIntro eyebrow="DEMO PRIVACY NOTICE" title="Your demo privacy." copy="A plain-language guide to this demonstration and the connected patient portal." /><section className="clinic-container clinic-section clinic-prose"><h2>Demo information</h2><p>The sample patient, clinicians, reports, and bills are fictional. Self bookings are stored in session storage for this tab. Contact form messages and someone else’s booking details are not saved or sent. Use fictional information when exploring.</p><h2>Connected clinic access</h2><p>The clinic sign-in uses the configured appointment API. The portal keeps its session in session storage and clears it on sign-out or an expired session. The connected appointment system verifies patient identity and only returns patient-scoped records and released diagnostic results.</p><h2>Downloads and reset</h2><p>Calendar and report downloads create files on your device. Closing the tab clears its demo session storage. A page reload resets a demo password change; no clinic password is affected.</p><h2>No clinical or payment service</h2><p>The demo does not reserve real appointments, deliver messages, collect payments, or provide medical advice. This notice describes the prototype and is not a production clinic privacy policy.</p></section></>}
    </main>
    <section className="clinic-container clinic-bottom-cta"><div><h2>Your next step starts here.</h2><p>Explore the experience. Plan a sample visit.</p></div><button className="clinic-button clinic-button-cream" onClick={() => onBook()}>Book a demo visit <ArrowUpRight size={20} /></button></section>
    <footer className="clinic-container clinic-footer"><div className="clinic-footer-main"><div><Brand /><p>A little more care.<br />Every step of the way.</p></div><div><h3>Explore</h3><a href="#/services">Our services</a><a href="#/doctors">Our doctors</a><a href="#/about">About this demo</a></div><div><h3>For patients</h3><a href={signedIn ? '#/dashboard' : '#/portal'}>Patient portal</a><a href="#/faq">Questions & answers</a><a href="#/contact">Contact & help</a></div><div className="clinic-footer-note"><MapPin size={18} /><strong>A fictional clinic.<br />A complete demo experience.</strong><p>For medical emergencies, contact your local emergency services.</p></div></div><div className="clinic-footer-bottom"><span>© {new Date().getFullYear()} HIMS Demo Clinic. For demonstration only.</span><a href="#/privacy">Privacy & demo information <ArrowUpRight size={13} /></a></div><ImageCredits /></footer>
  </div>;
}

function PageIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return <section className="clinic-page-intro"><div className="clinic-container"><h1>{title}</h1><p>{copy}</p><a className="clinic-intro-breadcrumb" href="#/home">Home <ArrowRight size={13} /> {eyebrow.toLowerCase()}</a></div></section>;
}

function ServiceDirectory({ onBook }: { onBook: (service?: number) => void }) {
  const [category, setCategory] = useState('All services');
  const [query, setQuery] = useState('');
  const filtered = demoServices.filter((service) => (category === 'All services' || service.category === category) && `${service.name} ${service.description}`.toLowerCase().includes(query.toLowerCase()));
  return <section className="clinic-container clinic-section clinic-directory-section"><div className="clinic-directory-toolbar"><div className="clinic-filter-tabs" role="group" aria-label="Service categories">{['All services', 'Consultations', 'Laboratory', 'Imaging'].map((item) => <button key={item} aria-pressed={category === item} onClick={() => setCategory(item)}>{item}</button>)}</div><label className="clinic-search"><Search size={17} /><input aria-label="Search services" placeholder="Find a service" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div><p className="clinic-caption" role="status">{filtered.length} sample services · Illustrative fees in PHP</p><div className="clinic-service-grid">{filtered.map((service) => <article className="clinic-service-card" key={service.id}><div className="clinic-service-top"><span className="clinic-service-icon"><ServiceIcon name={service.icon} /></span><span>{service.category}</span></div><h3>{service.name}</h3><p>{service.description}</p><div className="clinic-service-fee"><strong>{money(service.price)}</strong><small>Sample fee</small></div><button className="clinic-text-link" onClick={() => onBook(service.id)}>Book this service <ArrowUpRight size={18} /></button></article>)}</div>{!filtered.length && <div className="clinic-empty"><Search size={30} /><h2>No matching services</h2><p>Try a different search or browse every service.</p><button className="clinic-button clinic-button-dark" onClick={() => { setCategory('All services'); setQuery(''); }}>Clear filters</button></div>}</section>;
}

function DoctorDirectory({ compact = false, onBook }: { compact?: boolean; onBook: (service?: number) => void }) {
  const [specialty, setSpecialty] = useState('All specialties');
  const [selected, setSelected] = useState<typeof doctors[number] | null>(null);
  return <>{!compact && <div className="clinic-directory-toolbar"><label className="field">Specialty<select aria-label="Specialty" value={specialty} onChange={(event) => setSpecialty(event.target.value)}><option>All specialties</option>{doctors.map((doctor) => <option key={doctor.specialty}>{doctor.specialty}</option>)}</select></label><p className="clinic-caption">Illustrative profiles. These are not practicing clinician listings.</p></div>}<div className="clinic-doctor-grid">{doctors.filter((doctor) => specialty === 'All specialties' || specialty === doctor.specialty).map((doctor) => <article className="clinic-doctor-card" key={doctor.name} data-clinic-reveal><div className={`clinic-doctor-portrait ${doctor.color}`}><span className="clinic-doctor-initials" aria-hidden="true">{doctor.initials}</span><button onClick={() => setSelected(doctor)} aria-label={`View profile: ${doctor.name}`}><ArrowUpRight size={22} /></button></div><h3>{doctor.name}</h3><p>{doctor.specialty}</p><button className="clinic-text-link" onClick={() => setSelected(doctor)}>Meet {doctor.name.split(' ')[1]} <ArrowRight size={15} /></button></article>)}</div>{selected && <Modal title={selected.name} onClose={() => setSelected(null)}><span className="clinic-profile-note">FICTIONAL CLINICIAN · DEMO PROFILE</span><h3>{selected.specialty}</h3><p className="muted">{selected.bio}</p><dl className="clinic-doctor-details"><dt>Sample focus</dt><dd>{selected.focus}</dd><dt>Illustrative clinic days</dt><dd>{selected.days}</dd></dl><Alert tone="info">Bookings in this demo select a service and visit date. A clinician or time slot is not reserved.</Alert><button className="clinic-button clinic-button-dark clinic-modal-action" onClick={() => { onBook(selected.service); setSelected(null); }}>Try a related booking <ArrowRight size={17} /></button></Modal>}</>;
}

function FaqList({ limit }: { limit?: number }) {
  return <div className="clinic-faq-list">{faqs.slice(0, limit).map((faq) => <details key={faq.q}><summary>{faq.q}<span><ArrowDown size={17} /></span></summary><p>{faq.a}</p></details>)}</div>;
}

function ContactPage() {
  const [sent, setSent] = useState(false);
  function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setSent(true); }
  return <section className="clinic-container clinic-contact-grid clinic-section"><div><h2>What can we help with?</h2><p className="muted">Use fictional details to try the form. You’ll see a local confirmation; no message or email is sent.</p><div className="clinic-contact-item"><MessageCircle /><div><h3>A quick answer</h3><p>Find guidance on access, visits, and results.</p><a className="clinic-text-link" href="#/faq">Read the FAQs <ArrowUpRight size={16} /></a></div></div><div className="clinic-contact-item"><Clock3 /><div><h3>Sample clinic hours</h3><p>Monday–Saturday · 8:00 AM–5:00 PM<br />Illustrative hours in Philippine time.</p></div></div><div className="clinic-contact-item"><MapPin /><div><h3>Demo location</h3><p>A fictional clinic in Metro Manila.<br />No physical clinic address is provided.</p></div></div></div><div className="clinic-contact-form">{sent ? <div className="clinic-form-success" role="status"><CheckCircle2 size={42} /><h2>Your demo message is complete.</h2><p>No message was sent or stored. This confirmation shows how the contact experience works.</p><button className="clinic-button clinic-button-dark" onClick={() => setSent(false)}>Try another message</button></div> : <form className="form-stack" onSubmit={submit}><h2>Leave a demo message</h2><Field label="Your name"><input required maxLength={100} placeholder="Use a fictional name" autoComplete="off" /></Field><Field label="Email address"><input type="email" required maxLength={150} placeholder="you@example.com" autoComplete="off" /></Field><Field label="I have a question about"><select required defaultValue=""><option value="" disabled>Select a topic</option><option>Appointments</option><option>Patient portal access</option><option>Results and billing</option><option>Something else</option></select></Field><Field label="Your message"><textarea required minLength={10} maxLength={2000} rows={5} placeholder="How can we help? Please use fictional details." /></Field><p className="clinic-caption">Please don’t enter medical records or real personal information.</p><button className="clinic-button clinic-button-dark">Submit demo message <ArrowUpRight size={18} /></button></form>}</div></section>;
}

export function PortalWelcome({ onDemo, signedIn }: { onDemo: () => void; signedIn: boolean }) {
  return <main className="clinic-site clinic-welcome"><a className="clinic-text-link" href="#/home">← Back to clinic website</a><div className="clinic-welcome-card"><span className="clinic-service-icon"><HeartPulse size={30} /></span><h1>Your patient portal.</h1><p>Appointments, released reports, billing, and your registered profile. Start exploring with a fictional patient.</p>{signedIn ? <a className="clinic-button clinic-button-dark" href="#/dashboard">Return to my portal <ArrowRight size={18} /></a> : <button className="clinic-button clinic-button-dark" onClick={onDemo}>Explore demo portal <ArrowUpRight size={18} /></button>}<div className="clinic-welcome-separator">Already have a clinic account?</div><a className="button button-secondary" href="#/login">Clinic patient sign in <ShieldCheck size={16} /></a><small>Demo access uses sample data only. Clinic sign-in connects to the existing appointment system.</small></div></main>;
}

export function DemoBooking({ initialService, onClose, onDone }: { initialService?: number; onClose: () => void; onDone: () => void }) {
  const [serviceId, setServiceId] = useState(initialService || 101);
  const [date, setDate] = useState(relativeDate(1));
  const [forSelf, setForSelf] = useState(true);
  const [otherName, setOtherName] = useState('');
  const [selfNotes, setSelfNotes] = useState('');
  const [otherNotes, setOtherNotes] = useState('');
  const notes = forSelf ? selfNotes : otherNotes;
  const setNotes = forSelf ? setSelfNotes : setOtherNotes;
  const [review, setReview] = useState(false);
  const [saved, setSaved] = useState<Appointment | null>(null);
  const [error, setError] = useState('');
  const pending = useRef(false);
  const service = demoServices.find((item) => item.id === serviceId) || demoServices[0];
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!review) { setReview(true); return; }
    if (pending.current) return;
    pending.current = true;
    try { setSaved(saveDemoBooking(serviceId, date, notes, forSelf)); }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save this demo. Please try again.'); pending.current = false; }
  }
  return <Modal title={saved ? 'Your demo visit is ready' : review ? 'Review your demo visit' : 'Plan a demo visit'} onClose={onClose}>
    {saved ? <div className="clinic-booking-success" role="status"><CheckCircle2 size={44} /><h3>One small step for your health.</h3><p>{service.name}<br />{longDate(saved.appointmentDate)}</p><span className="clinic-booking-reference">{saved.appointmentNo}</span><Alert tone="info">{forSelf ? 'Saved in this tab’s demo patient portal.' : 'This sample is for someone else. It is not saved in Alex’s patient record.'} No real appointment was created, no email was sent, and no payment was collected.</Alert><button className="clinic-button clinic-button-dark clinic-modal-action" onClick={forSelf ? onDone : onClose}>{forSelf ? 'View my demo appointments' : 'Done'} <ArrowRight size={18} /></button></div> : <form className="form-stack" onSubmit={submit}><Alert tone="info">Demo only · Use fictional information. No clinic appointment or time slot is reserved.</Alert>{review ? <><dl className="clinic-booking-review"><dt>Booking for</dt><dd>{forSelf ? 'Alex Santos · Demo patient' : `${otherName} · Separate sample patient`}</dd><dt>Service</dt><dd>{service.name}</dd><dt>Visit date</dt><dd>{longDate(date)}</dd><dt>Location</dt><dd>HIMS Demo Clinic</dd><dt>Illustrative fee</dt><dd>{money(service.price)} · No payment collected</dd><dt>Notes</dt><dd>{notes || 'No additional notes'}</dd></dl><p className="muted">{forSelf ? 'This visit will appear in Alex’s demo appointment list.' : 'This visit stays separate from Alex’s own appointments and registered profile. Other-person details are discarded when you close this form.'}</p><button type="button" className="text-action" onClick={() => { setReview(false); setError(''); }}>← Edit visit details</button></> : <><Field label="Who is this visit for?"><select value={forSelf ? 'self' : 'other'} onChange={(event) => { setForSelf(event.target.value === 'self'); }}><option value="self">Myself · Alex Santos (demo)</option><option value="other">Someone else (fictional details only)</option></select></Field>{!forSelf && <Field label="Other patient’s fictional name"><input required maxLength={100} value={otherName} onChange={(event) => setOtherName(event.target.value)} placeholder="Sample patient name" autoComplete="off" /></Field>}<Field label="Service"><select aria-label="Service" value={serviceId} onChange={(event) => setServiceId(Number(event.target.value))}>{demoServices.map((item) => <option key={item.id} value={item.id}>{item.name} · {money(item.price)}</option>)}</select></Field><Field label="Visit date"><input type="date" value={date} min={clinicToday()} required onChange={(event) => setDate(event.target.value)} /></Field><Field label="Booking notes (optional)"><textarea rows={3} maxLength={500} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Use fictional details only" /></Field><div className="clinic-booking-fee"><span>Illustrative service fee</span><strong>{money(service.price)}</strong></div></>}{error && <Alert tone="error">{error}</Alert>}<button className="clinic-button clinic-button-dark">{review ? 'Confirm demo booking' : 'Review demo visit'} <ArrowRight size={18} /></button></form>}
  </Modal>;
}

function ImageCredits() {
  return <details className="clinic-image-credits"><summary>Image credits & illustrations</summary><p>The clinic interior is an AI-generated concept illustration. Service photographs show healthcare settings for illustration.</p><ul><li><a href="https://commons.wikimedia.org/wiki/File:Telemedicine_Consult.jpg">Telemedicine Consult</a> · Intel Free Press · <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC BY-SA 2.0</a></li><li><a href="https://commons.wikimedia.org/wiki/File:NABL_Accredited_Clinical_Pathology_Laboratory_in_Kharghar_Navi_Mumbai_Diagnostic_Services.jpg">Clinical pathology laboratory, Kharghar, Navi Mumbai</a> · Goleisureintl · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></li><li><a href="https://commons.wikimedia.org/wiki/File:A_modern_medical_ultrasound_scanner.jpg">A modern medical ultrasound scanner</a> · Harrison Keely · <a href="https://creativecommons.org/licenses/by/4.0/">CC BY 4.0</a></li></ul></details>;
}
