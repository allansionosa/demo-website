import { Bell, CalendarDays, FileHeart, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { portalApi } from '../api';
import { shortDate } from '../format';
import { useLoad } from '../hooks/use-load';
import { notificationFeed } from '../notification-model';
import { clinicToday } from '../record-tools';
import type { Page } from '../types';
import { Modal } from './modal';
import { Alert, EmptyState, PageError, PageLoading } from './shared';

const STATE_KEY = 'patient-portal-notifications';
type Preferences = { appointments: boolean; results: boolean };
type NotificationState = { read: string[]; preferences: Preferences };
function loadState(): NotificationState {
  try {
    const parsed: unknown = JSON.parse(sessionStorage.getItem(STATE_KEY) || 'null');
    if (parsed && typeof parsed === 'object' && 'read' in parsed && Array.isArray(parsed.read) &&
        parsed.read.every((id: unknown) => typeof id === 'string') &&
        'preferences' in parsed && parsed.preferences && typeof parsed.preferences === 'object' &&
        'appointments' in parsed.preferences && typeof parsed.preferences.appointments === 'boolean' &&
        'results' in parsed.preferences && typeof parsed.preferences.results === 'boolean') {
      return { read: parsed.read.slice(-200), preferences: { appointments: parsed.preferences.appointments, results: parsed.preferences.results } };
    }
  } catch { /* Missing or unavailable storage uses a fresh tab state. */ }
  return { read: [], preferences: { appointments: true, results: true } };
}

export function Notifications({ token, navigate }: { token: string; navigate: (page: Page) => void }) {
  const records = useLoad(useCallback(() => portalApi.getNotificationRecords(token), [token]));
  const reload = records.reload;
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('all');
  const [state, setState] = useState(loadState);
  const [today, setToday] = useState(clinicToday);
  useEffect(() => {
    try { sessionStorage.setItem(STATE_KEY, JSON.stringify(state)); } catch { /* Keep state in memory. */ }
  }, [state]);
  useEffect(() => {
    const refresh = () => { if (!document.hidden) { setToday(clinicToday()); reload(); } };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => { window.clearInterval(timer); window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [reload]);
  const notifications = records.data ? notificationFeed(records.data.appointments, records.data.results, today)
    .filter((item) => state.preferences[item.kind]) : [];
  const unread = notifications.filter((item) => !state.read.includes(item.id));
  const visible = filter === 'unread' ? unread : notifications;
  const read = (id: string, markRead: boolean) => setState((previous) => ({ ...previous,
    read: markRead ? [...new Set([...previous.read, id])].slice(-200) : previous.read.filter((value) => value !== id),
  }));
  return <>
    <button className="icon-button notification-trigger" aria-label={`Notifications${unread.length ? `, ${unread.length} unread` : ''}`} onClick={() => setOpen(true)}>
      <Bell size={19} />{unread.length > 0 && <span className="notification-count" aria-hidden="true">{unread.length > 99 ? '99+' : unread.length}</span>}
    </button>
    {open && <Modal title="Notifications" onClose={() => setOpen(false)} wide>
      <p className="muted">Up to 200 updates from your own appointments and released reports. Read state and display preferences apply to this tab until you sign out.</p>
      <fieldset className="notification-preferences"><legend>Show updates for</legend>{(['appointments', 'results'] as const).map((kind) => <label key={kind}><input type="checkbox" checked={state.preferences[kind]} onChange={(event) => setState((previous) => ({ ...previous, preferences: { ...previous.preferences, [kind]: event.target.checked } }))} />{kind === 'appointments' ? 'Appointments' : 'Released results'}</label>)}</fieldset>
      <div className="notification-toolbar"><div className="segmented-control" role="group" aria-label="Notification filter"><button aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>All updates</button><button aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>Unread ({unread.length})</button></div><button className="text-action" disabled={!unread.length} onClick={() => setState((previous) => ({ ...previous, read: [...new Set([...previous.read, ...notifications.map((item) => item.id)])].slice(-200) }))}>Mark all read</button><button className="icon-button" aria-label="Refresh notifications" disabled={records.loading} onClick={records.reload}><RefreshCw size={18} /></button></div>
      {records.loading ? <PageLoading compact /> : records.error ? <PageError message={records.error} retry={records.reload} compact /> : !visible.length ? <EmptyState icon={Bell} title={filter === 'unread' ? 'You’re all caught up' : 'No updates to show'} copy="Your appointment and released-report updates appear here." /> : <ul className="notification-list">
        {visible.map((item) => <li key={item.id} className={state.read.includes(item.id) ? '' : 'notification-unread'}>
          <button className="notification-open" onClick={() => { read(item.id, true); setOpen(false); navigate(item.kind); }}>
            {item.kind === 'results' ? <FileHeart size={20} /> : <CalendarDays size={20} />}<span><strong>{item.title}</strong><span>{item.description}</span><small>{item.kind === 'results' ? 'Released' : 'Visit date'}: {shortDate(item.date)}</small></span>{!state.read.includes(item.id) && <span className="unread-dot" aria-label="Unread" />}
          </button><button className="text-action" onClick={() => read(item.id, !state.read.includes(item.id))}>{state.read.includes(item.id) ? 'Mark unread' : 'Mark read'}</button>
        </li>)}
      </ul>}
      {!state.preferences.appointments && !state.preferences.results && <Alert tone="info">Select an update category to see notifications.</Alert>}
    </Modal>}
  </>;
}
