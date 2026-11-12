import type { Appointment, DiagnosticResult } from './types';
import { appointmentStatus, isUpcoming, recordDate, resultKey, resultTimestamp } from './record-tools.ts';

export type PortalNotification = {
  id: string;
  kind: 'appointments' | 'results';
  title: string;
  description: string;
  date: string;
  upcoming: boolean;
};

export function notificationFeed(appointments: Appointment[], results: DiagnosticResult[], today: string): PortalNotification[] {
  return [
    ...results.map((result): PortalNotification => ({
      id: `result:${resultKey(result)}:${resultTimestamp(result)}`,
      kind: 'results', title: 'Released report', description: result.description,
      date: resultTimestamp(result), upcoming: false,
    })),
    ...appointments.map((appointment): PortalNotification => ({
      id: `visit:${appointment.id}:${recordDate(appointment.appointmentDate)}:${appointmentStatus(appointment)}`,
      kind: 'appointments', title: isUpcoming(appointment, today) ? 'Upcoming visit' : 'Visit status',
      description: `${appointment.branch} · ${appointmentStatus(appointment)}`,
      date: appointment.appointmentDate, upcoming: isUpcoming(appointment, today),
    })),
  ].sort((a, b) => a.upcoming !== b.upcoming ? (a.upcoming ? -1 : 1)
    : a.upcoming ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)).slice(0, 200);
}
