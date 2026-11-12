import { CalendarDays, ChevronDown, FileText, MapPin, WalletCards } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { portalApi } from '../api';
import { appointmentUrl } from '../booking-bridge';
import { clinicInformation, safeDirectionsUrl } from '../clinic-information';
import { Alert, EmptyState, PageError, PageLoading, PageTitle, StatusBadge } from '../components/shared';
import { day, money, month, year } from '../format';
import { useLoad } from '../hooks/use-load';
import { appointmentCalendar, appointmentStatus, clinicToday, downloadFile, isUpcoming, recordDate } from '../record-tools';
import type { Appointment } from '../types';

export function AppointmentsPage({ token }: { token: string }) {
  const state = useLoad(useCallback(() => portalApi.getAppointments(token), [token]));
  const [view, setView] = useState('upcoming');
  const [status, setStatus] = useState('all');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [today, setToday] = useState(clinicToday);
  useEffect(() => {
    const timer = window.setInterval(() => setToday(clinicToday()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  if (state.loading) return <PageLoading />;
  if (state.error || !state.data) return <PageError message={state.error} retry={state.reload} />;
  const statuses = [...new Set(state.data.map(appointmentStatus))].sort();
  const invalidDates = Boolean(from && to && from > to);
  const appointments = state.data.filter((appointment) => {
    const date = recordDate(appointment.appointmentDate);
    return (view === 'all' || (view === 'upcoming' ? isUpcoming(appointment, today) : !isUpcoming(appointment, today))) &&
      (status === 'all' || appointmentStatus(appointment) === status) &&
      (!from || date >= from) && (!to || date <= to);
  }).sort((a, b) => view === 'upcoming'
    ? a.appointmentDate.localeCompare(b.appointmentDate)
    : b.appointmentDate.localeCompare(a.appointmentDate));
  const reset = () => { setView('all'); setStatus('all'); setFrom(''); setTo(''); };

  return <div className="page-stack">
    <PageTitle eyebrow="Visits" title="Appointments" copy="Your own bookings, visit dates, and service details."
      action={<a className="button button-primary" href={appointmentUrl}><CalendarDays size={18} /> Book new</a>} />
    <div className="segmented-control" role="group" aria-label="Appointment period">
      {[['upcoming', 'Upcoming'], ['past', 'Past and closed'], ['all', 'All visits']].map(([value, label]) =>
        <button type="button" key={value} aria-pressed={view === value} onClick={() => setView(value)}>{label}</button>)}
    </div>
    <div className="filter-grid">
      <label className="field">Status<select aria-label="Status" value={status} onChange={(event) => setStatus(event.target.value)}>
        <option value="all">All statuses</option>{statuses.map((value) => <option key={value}>{value}</option>)}
      </select></label>
      <label className="field">From date<input type="date" value={from} onChange={(event) => setFrom(event.target.value)} /></label>
      <label className="field">To date<input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} /></label>
      <button type="button" className="button button-secondary filter-reset" onClick={reset}>Reset filters</button>
    </div>
    {invalidDates && <Alert tone="error">Choose a to date on or after the from date.</Alert>}
    <span className="record-count" role="status">{invalidDates ? 0 : appointments.length} visit{appointments.length === 1 ? '' : 's'}</span>
    {!invalidDates && appointments.length ? <section className="appointment-list" aria-label="Your appointments">
      {appointments.map((appointment) => <AppointmentCard key={appointment.id} appointment={appointment} upcoming={isUpcoming(appointment, today)} />)}
    </section> : <section className="card"><EmptyState icon={CalendarDays}
      title={state.data.length ? 'No matching appointments' : 'No appointments found'}
      copy={state.data.length ? 'Try another period or clear your filters to see your visits.' : 'Your booked appointments will appear here.'}
      action={state.data.length ? <button className="button button-secondary" onClick={reset}>Show all visits</button> : undefined} /></section>}
  </div>;
}

function AppointmentCard({ appointment, upcoming }: { appointment: Appointment; upcoming: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const [notice, setNotice] = useState('');
  const clinic = clinicInformation[appointment.branch];
  const directions = safeDirectionsUrl(clinic?.directionsUrl);
  const detailsId = `appointment-services-${appointment.id}`;
  return <article className="card appointment-card">
    <div className="appointment-date"><strong>{day(appointment.appointmentDate)}</strong><span>{month(appointment.appointmentDate)}</span><small>{year(appointment.appointmentDate)}</small></div>
    <div className="appointment-main">
      <div className="appointment-heading"><div><span className="mono-label">{appointment.appointmentNo}</span><h3>{appointment.services[0]?.description || 'Hospital appointment'}</h3></div><StatusBadge status={appointmentStatus(appointment)} /></div>
      <div className="detail-strip"><span><MapPin size={16} />{appointment.branch}</span><span><FileText size={16} /> Invoice {appointment.invoiceNumber}</span><span><WalletCards size={16} />{money(appointment.totalAmount)}</span></div>
      {appointment.notes && <p className="appointment-note">{appointment.notes}</p>}
      {upcoming && <div className="appointment-actions"><button className="button button-small button-secondary" onClick={() => {
        try { downloadFile(appointmentCalendar(appointment), 'clinic-visit.ics', 'text/calendar;charset=utf-8'); setNotice('Calendar file downloaded. This visit has no reserved time slot.'); }
        catch { setNotice('The visit date is unavailable. Please try again after refreshing.'); }
      }}><CalendarDays size={16} /> Add to calendar</button>{directions && <a className="button button-small button-secondary" href={directions} target="_blank" rel="noopener noreferrer"><MapPin size={16} /> Directions</a>}</div>}
      {notice && <Alert tone="info">{notice}</Alert>}
      {clinic?.address && <p className="appointment-note">{clinic.address}</p>}
      <button className="text-action appointment-toggle" aria-expanded={expanded} aria-controls={detailsId} onClick={() => setExpanded(!expanded)}>{expanded ? 'Hide' : 'Show'} booked services <ChevronDown className={expanded ? 'rotated' : ''} size={16} /></button>
      <div id={detailsId} hidden={!expanded}>
        <div className="service-list">{appointment.services.map((service) => <div key={service.id}><span><strong>{service.description}</strong><small>{service.department || 'Hospital service'} · Qty {service.quantity}</small>{clinic?.preparationByItemId[service.itemId] && <p className="preparation-copy"><strong>Before your visit:</strong> {clinic.preparationByItemId[service.itemId]}</p>}</span><strong>{money(service.price * service.quantity)}</strong></div>)}</div>
      </div>
    </div>
  </article>;
}
