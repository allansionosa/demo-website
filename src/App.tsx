import {
  Activity,
  ArrowRight,
  BadgeCheck,
  CalendarDays,
  ChevronDown,
  FileHeart,
  HeartPulse,
  Home,
  KeyRound,
  LockKeyhole,
  LogOut,
  Mail,
  Menu,
  Phone,
  ReceiptText,
  RefreshCw,
  ShieldCheck,
  UserRound,
  WalletCards,
  X,
} from 'lucide-react';
import type { FormEvent } from 'react';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { getStoredSession, onSessionExpired, portalApi, storeSession } from './api';
import { useBookingBridge } from './booking-bridge';
import BookingPage from './booking/BookingPage';
import type {
  PatientProfile,
  Session,
  Page,
} from './types';

import { errorMessage, initials, money, shortDate, longDate, strongPassword } from './format';
import { useLoad } from './hooks/use-load';
import { Alert, CardHeader, Field, MoneyLine, NavButton, PageError, PageLoading, PageTitle, PasswordRules, ProfileItem, StatusBadge, EmptyState } from './components/shared';
import { Modal } from './components/modal';
import { DashboardPage } from './pages/dashboard';
import { AppointmentsPage } from './pages/appointments';
import { ResultsPage } from './pages/results';
import { Notifications } from './components/notifications';
import { createDemoSession, isDemoSession } from './demo';
import { DemoBooking, PortalWelcome, Website } from './pages/website';
import { isPublicPage } from './website-routes';

const navigation: Array<{ page: Page; label: string; icon: typeof Home }> = [
  { page: 'dashboard', label: 'Overview', icon: Home },
  { page: 'appointments', label: 'Appointments', icon: CalendarDays },
  { page: 'results', label: 'Results', icon: FileHeart },
  { page: 'billing', label: 'Billing', icon: ReceiptText },
  { page: 'profile', label: 'My profile', icon: UserRound },
  { page: 'security', label: 'Security', icon: ShieldCheck },
];

function currentPage(): Page {
  const value = window.location.hash.replace('#/', '') as Page;
  return navigation.some((item) => item.page === value) ? value : 'dashboard';
}

function App() {
  const [session, setSessionState] = useState<Session | null>(getStoredSession);
  const [page, setPage] = useState<Page>(currentPage);
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#\//, '') || 'home');
  const [demoBooking, setDemoBooking] = useState<{ service?: number } | null>(null);
  const [portalRevision, setPortalRevision] = useState(0);
  const [sessionNotice, setSessionNotice] = useState('');
  const [bookingSignIn, setBookingSignIn] = useState(false);

  const setSession = useCallback((next: Session | null) => {
    storeSession(next);
    setSessionState(next);
    setSessionNotice('');
  }, []);
  const booking = useBookingBridge(isDemoSession(session?.token) ? null : session, setSession);

  const startDemo = () => {
    setSession(createDemoSession());
    window.location.hash = '/dashboard';
  };
  const openDemoBooking = (service?: number) => setDemoBooking({ service });
  const startBooking = () => {
    if (isDemoSession(session?.token)) openDemoBooking();
    else window.location.hash = '/book';
  };

  useEffect(() => onSessionExpired((expiredToken) => {
    if (expiredToken !== session?.token) return;
    setSessionState(null);
    setSessionNotice('Your session has expired. Sign in again to return to where you left off.');
  }), [session]);

  useEffect(() => {
    const syncRoute = () => {
      const next = window.location.hash.replace(/^#\//, '') || 'home';
      setRoute(next);
      setPage(currentPage());
    };
    window.addEventListener('hashchange', syncRoute);
    return () => window.removeEventListener('hashchange', syncRoute);
  }, []);

  useEffect(() => {
    if (!isPublicPage(route)) document.title = `${route === 'portal' || route === 'login' ? 'Patient access' : navigation.find((item) => item.page === page)?.label || 'Patient portal'} | HIMS Patient Portal`;
  }, [route, page]);

  const bookingDialog = demoBooking && <DemoBooking initialService={demoBooking.service} onClose={() => { setDemoBooking(null); setPortalRevision((value) => value + 1); }} onDone={() => {
    if (!isDemoSession(session?.token)) setSession(createDemoSession());
    setDemoBooking(null);
    setPortalRevision((value) => value + 1);
    window.location.hash = '/appointments';
    setPage('appointments');
    setRoute('appointments');
  }} />;

  // A booking handoff and an expired authenticated route must still reach the
  // original sign-in screen, even though the public website now has a home page.
  if (route === 'book' && !booking.bridgeMode && !isDemoSession(session?.token)) {
    const authentication = session?.mustChangePassword
      ? <FirstPasswordChange session={session} onChanged={(next) => { setSession(next); setBookingSignIn(false); }} onLogout={() => setSession(null)} />
      : !session && (bookingSignIn || sessionNotice)
        ? <Login notice={sessionNotice} onLogin={(next) => { setSession(next); setBookingSignIn(false); }} />
        : null;
    return <BookingPage session={session} onSignIn={() => setBookingSignIn(true)} authentication={authentication} />;
  }
  if (!booking.bridgeMode && isPublicPage(route)) return <><Website route={route} signedIn={Boolean(session)} onDemo={session ? () => { window.location.hash = '/dashboard'; } : startDemo} onBook={isDemoSession(session?.token) ? openDemoBooking : startBooking} />{bookingDialog}</>;
  if (route === 'portal' && !booking.bridgeMode) return <PortalWelcome signedIn={Boolean(session)} onDemo={startDemo} />;
  if (!session) return <Login onLogin={(next) => {
    setSession(next);
    if (route === 'login') window.location.hash = '/dashboard';
  }} notice={sessionNotice} />;

  if (session.mustChangePassword) {
    return (
      <FirstPasswordChange
        session={session}
        onChanged={setSession}
        onLogout={() => setSession(null)}
      />
    );
  }

  if (booking.bridgeMode) {
    return (
      <main className="login-panel booking-connect">
        <section className="login-card">
          <h1>Use your patient profile</h1>
          <p>Signed in as {session.patient.fullName} ({session.patient.patientNo}).</p>
          <p>Your appointment form will use your registered profile. You can choose to book for yourself or someone else there.</p>
          <button className="button button-primary" type="button" onClick={booking.continueBooking}>
            Continue to appointment
          </button>
          <button className="button button-secondary" type="button" onClick={() => setSession(null)}>
            Use a different account
          </button>
        </section>
      </main>
    );
  }

  return (
    <div style={{ display: 'contents' }} onClickCapture={(event) => {
      if (isDemoSession(session.token) && event.target instanceof Element) {
        const link = event.target.closest('a');
        if (link?.hash === '#/book') {
          event.preventDefault();
          openDemoBooking();
        }
        return;
      }
    }}>
      <PortalLayout
        key={portalRevision}
        session={session}
        page={page}
        onNavigate={(next) => {
          window.location.hash = `/${next}`;
          setPage(next);
        }}
        onSessionChange={setSession}
        onDemoBooking={() => openDemoBooking()}
      />
      {bookingDialog}
    </div>
  );
}

function Login({ onLogin, notice }: { onLogin: (session: Session) => void; notice: string }) {
  const [patientNo, setPatientNo] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      onLogin(await portalApi.login(patientNo.trim(), password));
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      {notice && <div className="session-notice"><Alert tone="info">{notice}</Alert></div>}
      <section className="login-story" aria-label="Patient portal introduction">
        <div className="brand brand-light">
          <span className="brand-mark">
            <HeartPulse size={24} />
          </span>
          <span>
            <strong>HIMS</strong>
            <small>Patient Portal</small>
          </span>
        </div>
        <div className="story-copy">
          <span className="eyebrow eyebrow-light">Your care, connected</span>
          <h1>Your health information, ready when you need it.</h1>
          <p>
            Review your appointments, released diagnostic results, and hospital
            bills in one secure place.
          </p>
          <div className="trust-list">
            <span>
              <ShieldCheck size={18} /> Private and patient-specific
            </span>
            <span>
              <FileHeart size={18} /> Validated results only
            </span>
            <span>
              <CalendarDays size={18} /> Your complete appointment history
            </span>
          </div>
        </div>
        <p className="story-footnote">
          For medical emergencies, contact your hospital or local emergency
          services.
        </p>
      </section>

      <section className="login-panel">
        <div className="login-card">
          <div className="mobile-brand brand">
            <span className="brand-mark">
              <HeartPulse size={22} />
            </span>
            <span>
              <strong>HIMS</strong>
              <small>Patient Portal</small>
            </span>
          </div>
          <span className="eyebrow">Secure patient access</span>
          <h2>Welcome back</h2>
          <p className="muted">
            Use the patient number and temporary password sent to your email.
          </p>

          <form className="form-stack" onSubmit={submit}>
            <Field label="Patient number">
              <div className="input-wrap">
                <UserRound size={18} />
                <input
                  value={patientNo}
                  onChange={(event) => setPatientNo(event.target.value)}
                  autoComplete="username"
                  placeholder="Enter your patient number"
                  required
                  autoFocus
                />
              </div>
            </Field>
            <Field label="Password">
              <div className="input-wrap">
                <LockKeyhole size={18} />
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  required
                />
              </div>
            </Field>
            {error && <Alert tone="error">{error}</Alert>}
            <button
              className="button button-primary button-block"
              disabled={loading}
            >
              {loading ? (
                <>
                  <RefreshCw className="spin" size={18} /> Signing in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={18} />
                </>
              )}
            </button>
            <button
              className="link-button"
              type="button"
              onClick={() => setForgotOpen(true)}
            >
              Forgot your password?
            </button>
          </form>

          <div className="help-note">
            <Mail size={17} />
            <span>
              Don’t have access yet? Accounts are emailed after your online
              appointment is admitted in HIMS.
            </span>
          </div>
          <div className="clinic-login-links"><a className="text-action" href="#/home">← Clinic website</a><a className="text-action" href="#/portal">Explore the demo</a></div>
        </div>
      </section>
      {forgotOpen && <ForgotPassword onClose={() => setForgotOpen(false)} />}
    </main>
  );
}

function ForgotPassword({ onClose }: { onClose: () => void }) {
  const [patientNo, setPatientNo] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const response = await portalApi.forgotPassword(
        patientNo.trim(),
        email.trim(),
      );
      setMessage(response.message);
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Modal title="Reset your password" onClose={onClose}>
      {message ? (
        <div className="success-state">
          <span>
            <Mail size={28} />
          </span>
          <h3>Check your email</h3>
          <p>{message}</p>
          <button className="button button-primary" onClick={onClose}>
            Back to sign in
          </button>
        </div>
      ) : (
        <form className="form-stack" onSubmit={submit}>
          <p className="muted">
            We’ll send a new temporary password to the email registered with
            your appointment.
          </p>
          <Field label="Patient number">
            <input
              value={patientNo}
              onChange={(event) => setPatientNo(event.target.value)}
              required
            />
          </Field>
          <Field label="Booking email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </Field>
          {error && <Alert tone="error">{error}</Alert>}
          <button
            className="button button-primary button-block"
            disabled={loading}
          >
            {loading ? 'Sending…' : 'Send temporary password'}
          </button>
        </form>
      )}
    </Modal>
  );
}

function FirstPasswordChange({
  session,
  onChanged,
  onLogout,
}: {
  session: Session;
  onChanged: (session: Session) => void;
  onLogout: () => void;
}) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (newPassword !== confirm)
      return setError('The new passwords do not match.');
    if (!strongPassword(newPassword))
      return setError(
        'Use at least 10 characters with uppercase, lowercase, a number, and a symbol.',
      );
    setLoading(true);
    setError('');
    try {
      await portalApi.changePassword(
        session.token,
        currentPassword,
        newPassword,
      );
      onChanged({ ...session, mustChangePassword: false });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="password-page">
      <section className="password-card">
        <span className="security-icon">
          <KeyRound size={28} />
        </span>
        <span className="eyebrow">First sign-in</span>
        <h1>Create your private password</h1>
        <p className="muted">
          For your protection, replace the temporary password before viewing
          health information.
        </p>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Temporary password">
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
              autoFocus
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </Field>
          <PasswordRules password={newPassword} />
          {error && <Alert tone="error">{error}</Alert>}
          <button
            className="button button-primary button-block"
            disabled={loading}
          >
            {loading ? 'Updating…' : 'Update password and continue'}
          </button>
          <button type="button" className="link-button" onClick={onLogout}>
            Sign out
          </button>
        </form>
      </section>
    </main>
  );
}

function PortalLayout({
  session,
  page,
  onNavigate,
  onSessionChange,
  onDemoBooking,
}: {
  session: Session;
  page: Page;
  onNavigate: (page: Page) => void;
  onSessionChange: (session: Session | null) => void;
  onDemoBooking: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const previousPage = useRef(page);
  useEffect(() => {
    if (previousPage.current !== page) {
      previousPage.current = page;
      contentRef.current?.focus();
    }
  }, [page]);
  useEffect(() => {
    const query = window.matchMedia('(max-width: 760px)');
    const closeOnDesktop = () => { if (!query.matches) setMenuOpen(false); };
    query.addEventListener('change', closeOnDesktop);
    return () => query.removeEventListener('change', closeOnDesktop);
  }, []);
  useEffect(() => {
    if (!menuOpen) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const controls = () => Array.from(menuRef.current?.querySelectorAll<HTMLButtonElement>('button:not([disabled])') || []);
    controls()[0]?.focus();
    const keydown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); setMenuOpen(false); }
      if (event.key !== 'Tab') return;
      const items = controls();
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', keydown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', keydown);
      if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
    };
  }, [menuOpen]);

  async function logout() {
    try {
      await portalApi.logout(session.token);
    } catch {
      /* Local logout still completes. */
    }
    onSessionChange(null);
  }

  const activeLabel = navigation.find((item) => item.page === page)?.label;

  return (
    <div className="portal-shell">
      <button className="skip-link" onClick={() => contentRef.current?.focus()}>Skip to page content</button>
      <aside ref={menuRef} id="portal-navigation" className={`sidebar ${menuOpen ? 'sidebar-open' : ''}`} role={menuOpen ? 'dialog' : undefined} aria-modal={menuOpen ? true : undefined} aria-label="Portal navigation">
        <div className="brand sidebar-brand">
          <span className="brand-mark">
            <HeartPulse size={22} />
          </span>
          <span>
            <strong>HIMS</strong>
            <small>Patient Portal</small>
          </span>
          <button
            className="icon-button close-menu"
            onClick={() => setMenuOpen(false)}
            aria-label="Close menu"
          >
            <X size={20} />
          </button>
        </div>
        <nav className="nav-list" aria-label="Patient portal navigation">
          <a className="clinic-sidebar-home" href="#/home"><ArrowRight size={15} /> Clinic website</a>
          <span className="nav-label">My health</span>
          {navigation.slice(0, 4).map((item) => (
            <NavButton
              key={item.page}
              {...item}
              active={page === item.page}
              onClick={() => {
                onNavigate(item.page);
                setMenuOpen(false);
              }}
            />
          ))}
          <span className="nav-label nav-label-spaced">Account</span>
          {navigation.slice(4).map((item) => (
            <NavButton
              key={item.page}
              {...item}
              active={page === item.page}
              onClick={() => {
                onNavigate(item.page);
                setMenuOpen(false);
              }}
            />
          ))}
        </nav>
        <div className="sidebar-patient">
          <span className="avatar">{initials(session.patient.fullName)}</span>
          <span>
            <strong>{session.patient.fullName}</strong>
            <small>{session.patient.patientNo}</small>
          </span>
          <button
            className="icon-button"
            onClick={logout}
            aria-label="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
      {menuOpen && (
        <button
          className="menu-scrim"
          onClick={() => setMenuOpen(false)}
          aria-label="Close menu overlay"
        />
      )}

      <main className="portal-main" inert={menuOpen}>
        <header className="topbar">
          <button
            className="icon-button mobile-menu"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            aria-controls="portal-navigation"
          >
            <Menu size={21} />
          </button>
          <div>
            <span className="topbar-kicker">Patient Portal</span>
            <strong>{activeLabel}</strong>
          </div>
          <div className="topbar-actions">
            <Notifications key={session.token} token={session.token} navigate={onNavigate} />
            <button
              className="profile-chip"
              onClick={() => onNavigate('profile')}
            >
              <span className="avatar avatar-small">
                {initials(session.patient.fullName)}
              </span>
              <span>{session.patient.firstName || session.patient.fullName}</span>
              <ChevronDown size={15} />
            </button>
          </div>
        </header>
        <div ref={contentRef} className="page-container" tabIndex={-1} aria-label={activeLabel}>
          {isDemoSession(session.token) && <div className="clinic-demo-banner" style={{ marginBottom: '1.3rem' }}><span><strong>Demo portal · Alex Santos</strong> — Fictional records. Sample bookings stay in this tab.</span><button type="button" className="text-action" onClick={onDemoBooking}>Try demo booking</button><a href="#/home">Clinic website ↗</a></div>}
          {page === 'dashboard' && (
            <DashboardPage session={session} navigate={onNavigate} />
          )}
          {page === 'appointments' && (
            <AppointmentsPage token={session.token} />
          )}
          {page === 'results' && <ResultsPage token={session.token} patient={session.patient} />}
          {page === 'billing' && <BillingPage token={session.token} />}
          {page === 'profile' && (
            <ProfilePage token={session.token} fallback={session.patient} />
          )}
          {page === 'security' && <SecurityPage session={session} />}
        </div>
      </main>
    </div>
  );
}

function BillingPage({ token }: { token: string }) {
  const state = useLoad(useCallback(() => portalApi.getBills(token), [token]));
  const [expanded, setExpanded] = useState<number | null>(null);
  if (state.loading) return <PageLoading />;
  if (state.error || !state.data)
    return <PageError message={state.error} retry={state.reload} />;
  const total = state.data.reduce((sum, bill) => sum + bill.amountToPay, 0);

  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Financial records"
        title="Billing and balances"
        copy="A summary of hospital charges, deductions, and recorded payments."
      />
      <section className="balance-banner">
        <div>
          <span>Current outstanding balance</span>
          <strong>{money(total)}</strong>
          <small>
            Across {state.data.filter((bill) => bill.amountToPay > 0).length}{' '}
            account(s)
          </small>
        </div>
        <span className="balance-icon">
          <WalletCards size={30} />
        </span>
      </section>
      <Alert tone="info">
        <ShieldCheck size={18} /> This is a billing summary and not an official
        receipt or Statement of Account. Please contact Billing for an official
        copy.
      </Alert>
      {!state.data.length ? (
        <section className="card">
          <EmptyState
            icon={ReceiptText}
            title="No billing records found"
            copy="Billing summaries from your admitted online appointments will appear here."
          />
        </section>
      ) : (
        <section className="bill-list">
          {state.data.map((bill) => (
            <article className="card bill-card" key={bill.caseId}>
              <button
                className="bill-summary"
                onClick={() =>
                  setExpanded(expanded === bill.caseId ? null : bill.caseId)
                }
              >
                <span className="bill-icon">
                  <ReceiptText size={21} />
                </span>
                <span className="bill-id">
                  <strong>
                    {bill.soaNo || bill.caseNo || `Case ${bill.caseId}`}
                  </strong>
                  <small>
                    {bill.appointmentNo
                      ? `Appointment ${bill.appointmentNo}`
                      : 'Hospital account'}{' '}
                    · {shortDate(bill.date)}
                  </small>
                </span>
                <StatusBadge status={bill.status} />
                <span className="bill-amount">
                  <strong>{money(bill.amountToPay)}</strong>
                  <small>Amount due</small>
                </span>
                <ChevronDown
                  className={expanded === bill.caseId ? 'rotated' : ''}
                  size={18}
                />
              </button>
              {expanded === bill.caseId && (
                <div className="bill-breakdown">
                  <MoneyLine
                    label="Hospital charges"
                    value={bill.hospitalBill}
                  />
                  <MoneyLine
                    label="Professional fees"
                    value={bill.professionalFees}
                  />
                  <MoneyLine
                    label="Gross amount"
                    value={bill.grossAmount}
                    strong
                  />
                  <MoneyLine
                    label="Deductions / coverage"
                    value={-bill.deductions}
                  />
                  <MoneyLine label="Recorded payments" value={-bill.payments} />
                  <MoneyLine label="Balance" value={bill.amountToPay} total />
                </div>
              )}
            </article>
          ))}
        </section>
      )}
    </div>
  );
}

function ProfilePage({
  token,
  fallback,
}: {
  token: string;
  fallback: PatientProfile;
}) {
  const state = useLoad(useCallback(() => portalApi.getProfile(token), [token]));
  const profile = state.data || fallback;
  if (state.loading) return <PageLoading />;
  if (state.error)
    return <PageError message={state.error} retry={state.reload} />;
  return (
    <div className="page-stack">
      <PageTitle
        eyebrow="Account"
        title="My profile"
        copy="Personal information registered in your hospital record."
      />
      <section className="profile-grid">
        <article className="card profile-identity">
          <span className="avatar avatar-large">
            {initials(profile.fullName)}
          </span>
          <h2>{profile.fullName}</h2>
          <span className="patient-number">
            Patient no. {profile.patientNo}
          </span>
            <span className="verified">
            <BadgeCheck size={16} /> {isDemoSession(token) ? 'Fictional demo patient' : 'Verified hospital record'}
          </span>
        </article>
        <article className="card card-large">
          <CardHeader title="Patient information" />
          <dl className="profile-details">
            <ProfileItem
              icon={UserRound}
              label="Full name"
              value={profile.fullName}
            />
            <ProfileItem
              icon={CalendarDays}
              label="Date of birth"
              value={longDate(profile.dateOfBirth)}
            />
            <ProfileItem
              icon={Activity}
              label="Sex"
              value={profile.sex || 'Not recorded'}
            />
            <ProfileItem icon={Mail} label="Email" value={profile.email} />
            <ProfileItem
              icon={Phone}
              label="Phone"
              value={profile.phone || 'Not recorded'}
            />
            <ProfileItem
              icon={Home}
              label="Address"
              value={profile.address || 'Not recorded'}
            />
          </dl>
          <Alert tone="neutral">
            To correct your demographic details, please contact Patient
            Registration. Changes require identity verification.
          </Alert>
        </article>
      </section>
    </div>
  );
}

function SecurityPage({ session }: { session: Session }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState<{
    tone: 'error' | 'success';
    text: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (loading) return;
    if (newPassword !== confirm)
      return setNotice({
        tone: 'error',
        text: 'The new passwords do not match.',
      });
    if (!strongPassword(newPassword))
      return setNotice({
        tone: 'error',
        text: 'Use at least 10 characters with uppercase, lowercase, a number, and a symbol.',
      });
    setLoading(true);
    setNotice(null);
    try {
      const response = await portalApi.changePassword(
        session.token,
        currentPassword,
        newPassword,
      );
      setNotice({ tone: 'success', text: response.message });
      setCurrentPassword('');
      setNewPassword('');
      setConfirm('');
    } catch (caught) {
      setNotice({ tone: 'error', text: errorMessage(caught) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-stack narrow-page">
      <PageTitle
        eyebrow="Account"
        title="Security"
        copy="Keep your portal credentials private and up to date."
      />
      <section className="card security-card">
        <span className="security-icon">
          <KeyRound size={25} />
        </span>
        <div>
          <h2>Change password</h2>
          <p className="muted">
            {isDemoSession(session.token) ? 'Try changing the demo password. Start with DemoCare!2026. Reloading or signing out resets it; no clinic credentials are changed.' : 'Changing your password revokes your other active portal sessions.'}
          </p>
        </div>
        <form className="form-stack" onSubmit={submit}>
          <Field label="Current password">
            <input
              type="password"
              autoComplete="current-password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="New password">
            <input
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              required
            />
          </Field>
          <Field label="Confirm new password">
            <input
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(event) => setConfirm(event.target.value)}
              required
            />
          </Field>
          <PasswordRules password={newPassword} />
          {notice && <Alert tone={notice.tone}>{notice.text}</Alert>}
          <button className="button button-primary" disabled={loading}>
            {loading ? 'Updating…' : 'Update password'}
          </button>
        </form>
      </section>
      <section className="card privacy-card">
        <ShieldCheck size={24} />
        <div>
          <h3>Protect your health information</h3>
          <p>
            Never share your password. Always sign out when using a shared
            device. Hospital staff will never ask for your password.
          </p>
        </div>
      </section>
    </div>
  );
}


export default App;
