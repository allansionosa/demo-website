import type { Appointment, DiagnosticResult } from './types';

export function clinicToday(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const part = (name: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === name)?.value || '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

export function recordDate(value?: string | null) {
  if (!value) return '';
  const match = /^(\d{4}-\d{2}-\d{2})(?:T|$)/.exec(value);
  if (!match || Number.isNaN(new Date(match[1]).getTime())) return '';
  return match[1];
}

export function appointmentStatus(appointment: Appointment) {
  return appointment.caseId ? 'Admitted' : appointment.status;
}

export function isUpcoming(appointment: Appointment, today = clinicToday()) {
  return recordDate(appointment.appointmentDate) >= today && !appointment.caseId &&
    !/cancel|completed|no[ -]?show/i.test(appointment.status);
}

export function resultKey(result: DiagnosticResult) {
  return `${result.departmentCode}-${result.examinationId}`;
}

export function resultTimestamp(result: DiagnosticResult) {
  return result.validatedDate || result.examinationDate || '';
}

function escapeCalendar(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}

function foldCalendarLine(line: string) {
  const chunks: string[] = [];
  let current = '';
  const encoder = new TextEncoder();
  for (const character of line) {
    if (encoder.encode(current + character).length > 73) {
      chunks.push(current);
      current = ' ';
    }
    current += character;
  }
  chunks.push(current);
  return chunks.join('\r\n');
}

export function appointmentCalendar(appointment: Appointment, now = new Date()) {
  const date = recordDate(appointment.appointmentDate);
  if (!date) throw new Error('This appointment does not have a valid visit date.');
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  const dateCode = date.replace(/-/g, '');
  const nextCode = next.toISOString().slice(0, 10).replace(/-/g, '');
  // Booking reserves a visit date, not a time slot. Keep the event all-day.
  const stamp = now.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  return [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Patient Portal//Visit//EN',
    'CALSCALE:GREGORIAN', 'BEGIN:VEVENT', `UID:portal-visit-${appointment.id}@patient-portal`,
    `DTSTAMP:${stamp}`, `DTSTART;VALUE=DATE:${dateCode}`, `DTEND;VALUE=DATE:${nextCode}`,
    'SUMMARY:Clinic visit', `LOCATION:${escapeCalendar(appointment.branch)}`,
    'DESCRIPTION:Visit date only. No time slot is reserved. Check your appointment in the patient portal.',
    'END:VEVENT', 'END:VCALENDAR', '',
  ].map(foldCalendarLine).join('\r\n');
}

export function downloadFile(content: string, filename: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
