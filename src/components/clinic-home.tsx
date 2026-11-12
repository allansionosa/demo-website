import { ArrowRight, ArrowUpRight, CalendarDays, Check, ChevronRight, FileCheck2, HeartPulse } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { demoServices, relativeDate } from '../demo';
import { money } from '../format';

const careOptions = [
  { title: 'A conversation first.', category: 'Consultations', copy: 'Everyday concerns, a follow-up, or care for your family. Find a place to start.', image: 'consultation.jpg', alt: 'A clinician reviewing information during a telemedicine consultation', service: 101 },
  { title: 'A clearer picture.', category: 'Laboratory', copy: 'Explore laboratory tests requested by your care team, with sample fees upfront.', image: 'laboratory.jpg', alt: 'Gloved laboratory staff preparing blood sample tubes for analysis', service: 102 },
  { title: 'The next step in care.', category: 'Imaging', copy: 'Browse diagnostic imaging and find released reports in your patient portal.', image: 'ultrasound.jpg', alt: 'An ultrasound scanner and its examination controls', service: 106 },
];

export function ClinicHome({ onDemo, onBook, children }: {
  onDemo: () => void;
  onBook: (service?: number) => void;
  children: React.ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [serviceId, setServiceId] = useState(demoServices[0].id);
  const service = demoServices.find((item) => item.id === serviceId) || demoServices[0];
  const visitDate = new Date(`${relativeDate(3)}T12:00:00+08:00`);

  useEffect(() => {
    if (!root.current || !('IntersectionObserver' in window)) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          entry.target.classList.add('clinic-revealed');
          observer.unobserve(entry.target);
        }
      }
    }, { threshold: 0.08 });
    root.current.querySelectorAll('[data-clinic-reveal]').forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return <div ref={root}>
    <section className="clinic-container clinic-home-hero" aria-labelledby="clinic-home-title">
      <figure className="clinic-masthead">
        <div className="clinic-masthead-crop"><img src="/images/clinic-concept.webp" width="1536" height="1024" alt="Concept illustration of a light-filled clinic with blue chairs, oak reception, and tropical greenery" fetchPriority="high" /></div>
      </figure>
      <div className="clinic-editorial-grid clinic-hero-intro">
        <div className="clinic-home-title">
          <h1 id="clinic-home-title"><span>Your care.</span>{' '}<span>Connected.</span></h1>
          <p>Consultations, diagnostics, and your patient record. Explore a more connected experience at HIMS Demo Clinic.</p>
          <div className="clinic-hero-links"><button className="clinic-button clinic-button-dark" onClick={() => onBook(serviceId)}>Plan a visit <ArrowUpRight size={18} /></button><a className="clinic-text-link" href="#/services">Find your care <ArrowUpRight size={19} /></a></div>
        </div>
        <form className="clinic-visit-finder" onSubmit={(event) => { event.preventDefault(); onBook(serviceId); }}>
          <label htmlFor="clinic-visit-service">What brings you in?</label>
          <select id="clinic-visit-service" value={serviceId} onChange={(event) => setServiceId(Number(event.target.value))}>{demoServices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select>
          <div className="clinic-finder-fee" aria-live="polite"><span>Sample service fee</span><strong>{money(service.price)}</strong></div>
          <button className="clinic-button clinic-button-dark" type="submit">Book an appointment <ArrowUpRight size={18} /></button>
          <small>Try a demo visit. No real appointment or payment.</small>
        </form>
      </div>
    </section>

    <section className="clinic-container clinic-section clinic-care-section" aria-labelledby="clinic-care-title">
      <div className="clinic-editorial-grid clinic-section-heading"><h2 id="clinic-care-title" data-clinic-reveal>Start with<br />what you need.</h2><div data-clinic-reveal><p>A consultation. A requested test. A little clarity about what comes next.</p><a className="clinic-text-link" href="#/services">Explore all services <ArrowUpRight size={18} /></a></div></div>
      <div className="clinic-care-stories">{careOptions.map((care) => <article className="clinic-care-story" key={care.category} data-clinic-reveal>
        <div className="clinic-care-image"><img src={`/images/${care.image}`} alt={care.alt} width="640" height="430" loading="lazy" decoding="async" /></div>
        <div className="clinic-care-story-copy"><h3>{care.category}</h3><p><strong>{care.title}</strong> {care.copy}</p><button className="clinic-text-link" onClick={() => onBook(care.service)}>Explore this care <ArrowUpRight size={18} /></button></div>
      </article>)}</div>
      <p className="clinic-caption">Demo services and fees. Confirm actual availability and pricing with your clinic.</p>
    </section>

    <section className="clinic-portal-band" aria-labelledby="clinic-portal-title">
      <div className="clinic-container clinic-editorial-grid clinic-portal-section">
        <div className="clinic-portal-copy" data-clinic-reveal><h2 id="clinic-portal-title">After the visit,<br />stay connected.</h2><p>Less searching for a report. More clarity about your next visit. Keep your own care together in the patient portal.</p><ul>{['Your upcoming appointments', 'Your released diagnostic reports', 'Your bills and registered profile'].map((text) => <li key={text}><Check size={17} />{text}</li>)}</ul><button className="clinic-button clinic-button-dark" onClick={onDemo}>Explore demo portal <ArrowUpRight size={18} /></button><small>No sign-up. A fictional patient, ready to explore.</small></div>
        <div className="clinic-portal-preview" data-ui data-clinic-reveal aria-label="Sample patient portal preview">
          <div className="clinic-preview-top"><span className="clinic-preview-mark"><HeartPulse size={20} /> HIMS</span><span>Sample patient record</span></div>
          <div className="clinic-preview-person"><span className="clinic-preview-avatar">AS</span><div><h3>Alex Santos</h3><p>Your care overview</p></div></div>
          <div className="clinic-preview-visit"><span className="clinic-preview-date"><strong>{visitDate.getDate()}</strong><small>{visitDate.toLocaleString('en', { month: 'short', timeZone: 'Asia/Manila' })}</small></span><div><strong>Primary care consultation</strong><small>Next visit · HIMS Demo Clinic</small></div><CalendarDays size={18} /></div>
          <div className="clinic-preview-report"><FileCheck2 size={20} /><div><strong>Complete blood count</strong><small>Sample report · Released</small></div><ChevronRight size={18} /></div>
          <button className="clinic-text-link" onClick={onDemo}>Open your sample record <ArrowRight size={16} /></button>
        </div>
      </div>
    </section>
    {children}
  </div>;
}
