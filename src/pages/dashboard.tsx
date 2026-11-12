import { CalendarDays, ChevronRight, ClipboardList, CreditCard, FileHeart, FileText, ShieldCheck, WalletCards } from 'lucide-react';
import { useCallback, useState } from 'react';
import { portalApi } from '../api';
import { appointmentUrl as APPOINTMENT_URL } from '../booking-bridge';
import type { DiagnosticResult, Page, Session } from '../types';
import { money } from '../format';
import { useLoad } from '../hooks/use-load';
import { Alert, CardHeader, EmptyState, MetricCard, NextAppointment, PageError, PageLoading, QuickAction, ResultsTable } from '../components/shared';
import { ResultModal } from './results';
import { longDate } from '../format';

export function DashboardPage({
  session,
  navigate,
}: {
  session: Session;
  navigate: (page: Page) => void;
}) {
  const state = useLoad(useCallback(() => portalApi.getDashboard(session.token), [session.token]));
  const [selected, setSelected] = useState<DiagnosticResult | null>(null);
  if (state.loading) return <PageLoading />;
  if (state.error || !state.data)
    return <PageError message={state.error} retry={state.reload} />;
  const data = state.data;

  return (
    <div className="page-stack">
      <section className="welcome-row">
        <div>
          <span className="eyebrow">Health overview</span>
          <h1>Good day, {data.profile.firstName || data.profile.fullName}</h1>
          <p className="muted">
            Here’s the latest activity in your patient record.
          </p>
        </div>
        <a className="button button-primary" href={APPOINTMENT_URL}>
          <CalendarDays size={18} /> Book an appointment
        </a>
      </section>
      <section className="card attention-card" aria-labelledby="attention-title">
        <CardHeader title="What needs my attention?" />
        <h2 id="attention-title" className="sr-only">What needs my attention?</h2>
        <div className="attention-grid">
          {data.nextAppointment && <QuickAction icon={CalendarDays} title="Prepare for your next visit" copy={`${longDate(data.nextAppointment.appointmentDate)} · ${data.nextAppointment.branch}`} onClick={() => navigate('appointments')} />}
          {data.recentResults[0] && <QuickAction icon={FileHeart} title="Review your latest released report" copy={data.recentResults[0].description} onClick={() => setSelected(data.recentResults[0])} />}
          {data.outstandingBalance > 0 && <QuickAction icon={WalletCards} title="Review your outstanding balance" copy={money(data.outstandingBalance)} onClick={() => navigate('billing')} />}
          {!data.nextAppointment && !data.recentResults.length && data.outstandingBalance <= 0 && <p className="muted">You have no upcoming visit, released report, or outstanding balance to review.</p>}
        </div>
      </section>
      <section className="metric-grid">
        <MetricCard
          icon={CalendarDays}
          label="Upcoming appointments"
          value={String(data.upcomingAppointments)}
          tone="blue"
          onClick={() => navigate('appointments')}
        />
        <MetricCard
          icon={FileHeart}
          label="Available results"
          value={String(data.availableResults)}
          tone="green"
          onClick={() => navigate('results')}
        />
        <MetricCard
          icon={WalletCards}
          label="Outstanding balance"
          value={money(data.outstandingBalance)}
          tone="amber"
          onClick={() => navigate('billing')}
        />
      </section>
      <div className="dashboard-grid">
        <section className="card card-large">
          <CardHeader
            title="Next appointment"
            action={
              data.nextAppointment ? (
                <button
                  className="text-action"
                  onClick={() => navigate('appointments')}
                >
                  View all <ChevronRight size={16} />
                </button>
              ) : undefined
            }
          />
          {data.nextAppointment ? (
            <NextAppointment appointment={data.nextAppointment} />
          ) : (
            <EmptyState
              icon={CalendarDays}
              title="No upcoming appointments"
              copy="When you book your next visit, it will appear here."
              action={
                <a className="button button-secondary" href={APPOINTMENT_URL}>
                  Book now
                </a>
              }
            />
          )}
        </section>
        <section className="card">
          <CardHeader title="Quick actions" />
          <div className="quick-list">
            <QuickAction
              icon={ClipboardList}
              title="View appointments"
              copy="Check schedules and service details"
              onClick={() => navigate('appointments')}
            />
            <QuickAction
              icon={FileText}
              title="Review results"
              copy="Open validated diagnostic reports"
              onClick={() => navigate('results')}
            />
            <QuickAction
              icon={CreditCard}
              title="Check billing"
              copy="Review balances and payment history"
              onClick={() => navigate('billing')}
            />
          </div>
        </section>
      </div>
      <section className="card">
        <CardHeader
          title="Recent results"
          action={
            <button className="text-action" onClick={() => navigate('results')}>
              View all <ChevronRight size={16} />
            </button>
          }
        />
        {data.recentResults.length ? (
          <ResultsTable results={data.recentResults} compact onOpen={setSelected} />
        ) : (
          <EmptyState
            icon={FileHeart}
            title="No released results yet"
            copy="Validated diagnostic results will appear here when available."
          />
        )}
      </section>
      <Alert tone="info">
        <ShieldCheck size={18} /> This portal shows results after hospital
        validation. Contact your care team if you need help interpreting a
        report.
      </Alert>
      {selected && <ResultModal token={session.token} patient={data.profile} result={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}

