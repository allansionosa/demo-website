import { Activity, ChevronRight, ClipboardList, Home, RefreshCw, Stethoscope } from 'lucide-react';
import type { ReactNode } from 'react';
import type { Appointment, DiagnosticResult, Page } from '../types';
import { day, money, month, shortDate, year } from '../format';

export function NavButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  page: Page;
  label: string;
  icon: typeof Home;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={`nav-item ${active ? 'nav-active' : ''}`}
      aria-current={active ? 'page' : undefined}
      onClick={onClick}
    >
      <Icon size={19} />
      <span>{label}</span>
    </button>
  );
}

export function MetricCard({
  icon: Icon,
  label,
  value,
  tone,
  onClick,
}: {
  icon: typeof Home;
  label: string;
  value: string;
  tone: string;
  onClick: () => void;
}) {
  return (
    <button className="metric-card" onClick={onClick}>
      <span className={`metric-icon metric-${tone}`}>
        <Icon size={21} />
      </span>
      <span>
        <small>{label}</small>
        <strong>{value}</strong>
      </span>
      <ChevronRight size={18} />
    </button>
  );
}

export function NextAppointment({ appointment }: { appointment: Appointment }) {
  return (
    <div className="next-appointment">
      <div className="next-date">
        <span>{month(appointment.appointmentDate)}</span>
        <strong>{day(appointment.appointmentDate)}</strong>
        <small>{year(appointment.appointmentDate)}</small>
      </div>
      <div>
        <StatusBadge
          status={appointment.caseId ? 'Admitted' : appointment.status}
        />
        <h3>
          {appointment.services[0]?.description || 'Hospital appointment'}
        </h3>
        <p>
          <Stethoscope size={16} /> {appointment.branch}
        </p>
        <p>
          <ClipboardList size={16} /> {appointment.services.length} booked
          service{appointment.services.length === 1 ? '' : 's'}
        </p>
      </div>
    </div>
  );
}

export function ResultsTable({
  results,
  compact = false,
  onOpen,
}: {
  results: DiagnosticResult[];
  compact?: boolean;
  onOpen?: (result: DiagnosticResult) => void;
}) {
  return (
    <div className={`responsive-table ${compact ? 'table-compact' : ''}`}>
      <table>
        <thead>
          <tr>
            <th>Examination</th>
            <th>Department</th>
            <th>Performed</th>
            <th>Report no.</th>
            <th>Status</th>
            {onOpen && (
              <th>
                <span className="sr-only">Action</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {results.map((result) => (
            <tr key={`${result.departmentCode}-${result.examinationId}`}>
              <td data-label="Examination">
                <strong>{result.description}</strong>
                <small>{result.doctor || 'Diagnostic department'}</small>
              </td>
              <td data-label="Department">{result.department}</td>
              <td data-label="Performed">
                {shortDate(result.examinationDate)}
              </td>
              <td data-label="Report no.">{result.examinationNo || '—'}</td>
              <td data-label="Status">
                <StatusBadge status="Available" />
              </td>
              {onOpen && (
                <td>
                  <button
                    className="button button-small button-secondary"
                    onClick={() => onOpen(result)}
                    aria-label={`View result: ${result.description}`}
                  >
                    View result
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function QuickAction({
  icon: Icon,
  title,
  copy,
  onClick,
}: {
  icon: typeof Home;
  title: string;
  copy: string;
  onClick: () => void;
}) {
  return (
    <button className="quick-action" onClick={onClick}>
      <span>
        <Icon size={19} />
      </span>
      <span>
        <strong>{title}</strong>
        <small>{copy}</small>
      </span>
      <ChevronRight size={17} />
    </button>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const normalized = status.toLowerCase();
  const tone =
    normalized.includes('paid') ||
    normalized.includes('available') ||
    normalized.includes('admit')
      ? 'success'
      : normalized.includes('due') || normalized.includes('partial')
        ? 'warning'
        : 'info';
  return (
    <span className={`status status-${tone}`}>
      <i />
      {status}
    </span>
  );
}

export function MoneyLine({
  label,
  value,
  strong,
  total,
}: {
  label: string;
  value: number;
  strong?: boolean;
  total?: boolean;
}) {
  return (
    <div
      className={`money-line ${strong ? 'money-strong' : ''} ${total ? 'money-total' : ''}`}
    >
      <span>{label}</span>
      <strong>{value < 0 ? `−${money(Math.abs(value))}` : money(value)}</strong>
    </div>
  );
}

export function ProfileItem({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Home;
  label: string;
  value: string;
}) {
  return (
    <div>
      <dt>
        <Icon size={17} />
        {label}
      </dt>
      <dd>{value}</dd>
    </div>
  );
}

export function PageTitle({
  eyebrow,
  title,
  copy,
  action,
}: {
  eyebrow: string;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-title">
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h1>{title}</h1>
        <p className="muted">{copy}</p>
      </div>
      {action}
    </header>
  );
}

export function CardHeader({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <header className="card-header">
      <h2>{title}</h2>
      {action}
    </header>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

export function Alert({
  tone,
  children,
}: {
  tone: 'error' | 'success' | 'info' | 'neutral';
  children: ReactNode;
}) {
  return <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>{children}</div>;
}

export function EmptyState({
  icon: Icon,
  title,
  copy,
  action,
}: {
  icon: typeof Home;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={25} />
      </span>
      <h3>{title}</h3>
      <p>{copy}</p>
      {action}
    </div>
  );
}

export function PageLoading({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`loading-state ${compact ? 'loading-compact' : ''}`} role="status" aria-live="polite">
      <RefreshCw className="spin" size={24} />
      <span>Loading your records…</span>
    </div>
  );
}

export function PageError({
  message,
  retry,
  compact = false,
}: {
  message: string;
  retry: () => void;
  compact?: boolean;
}) {
  return (
    <div className={`error-state ${compact ? 'loading-compact' : ''}`}>
      <Activity size={25} />
      <h3>We couldn’t load this information</h3>
      <p>{message}</p>
      <button className="button button-secondary" onClick={retry}>
        <RefreshCw size={16} /> Try again
      </button>
    </div>
  );
}

export function PasswordRules({ password }: { password: string }) {
  const rules = [
    ['10+ characters', password.length >= 10],
    ['Upper and lowercase', /[A-Z]/.test(password) && /[a-z]/.test(password)],
    ['Number and symbol', /\d/.test(password) && /[^A-Za-z0-9]/.test(password)],
  ] as const;
  return (
    <div className="password-rules">
      {rules.map(([label, valid]) => (
        <span className={valid ? 'rule-valid' : ''} key={label}>
          <i>{valid ? '✓' : '·'}</i>
          {label}
        </span>
      ))}
    </div>
  );
}

