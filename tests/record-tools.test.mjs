import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appointmentCalendar, clinicToday, isUpcoming } from '../src/record-tools.ts';
import { notificationFeed } from '../src/notification-model.ts';
import { firstValue, reportModel } from '../src/report-model.ts';

const appointment = {
  id: 1, appointmentNo: 'TEST-001', invoiceNumber: 'TEST-INVOICE',
  appointmentDate: '2026-10-07T00:00:00', branch: 'Test clinic', status: 'Confirmed',
  totalAmount: 100, amountPaid: 0, services: [],
};

test('Philippine midnight changes the upcoming date independently of browser timezone', () => {
  assert.equal(clinicToday(new Date('2026-10-06T15:59:59Z')), '2026-10-06');
  assert.equal(clinicToday(new Date('2026-10-06T16:00:00Z')), '2026-10-07');
  assert.equal(isUpcoming(appointment, '2026-10-07'), true);
  assert.equal(isUpcoming({ ...appointment, status: 'Cancelled' }, '2026-10-07'), false);
  assert.equal(isUpcoming({ ...appointment, caseId: 3 }, '2026-10-07'), false);
  assert.equal(isUpcoming(appointment, '2026-10-08'), false);
});

test('calendar export uses an exclusive all-day end, handles year rollover, and excludes patient details', () => {
  const calendar = appointmentCalendar({ ...appointment, appointmentDate: '2026-12-31T00:00:00', branch: 'Test, clinic; East\nWing', notes: 'Private notes' }, new Date('2026-10-06T00:00:00Z'));
  assert.match(calendar, /DTSTART;VALUE=DATE:20261231/);
  assert.match(calendar, /DTEND;VALUE=DATE:20270101/);
  assert.match(calendar, /LOCATION:Test\\, clinic\\; East\\nWing/);
  assert.doesNotMatch(calendar, /Private notes|TEST-INVOICE|TEST-001|TZID|BEGIN:VALARM/);
  assert.ok(calendar.split('\r\n').every((line) => new TextEncoder().encode(line).length <= 75));
});

test('report mappings retain numeric zero, units and SI reference ranges with case-insensitive fields', () => {
  assert.equal(firstValue({ Result: 0, Value: 12 }, 'Result', 'Value'), '0');
  const report = reportModel({ departmentCode: 'LAB', header: { Name: 'Test Patient', PatientId: 100 }, details: [
    { test: 'Synthetic measurement', result: 0, Unit: 'mg/dL', Reference: '0–5', SIResult: 0, SIUnit: 'mmol/L', SIReference: '0–1', PrintRow: true },
    { Test: 'Hidden template row', Result: 5, PrintRow: false },
  ] });
  assert.equal(report.readings.length, 1);
  assert.deepEqual(report.readings[0].fields.map((field) => field.value), ['0', 'mg/dL', '0–5', '0', 'mmol/L', '0–1']);
  assert.ok(!report.meta.some((field) => field.value === '100'));
});

test('imaging report preserves multiple narratives and cardiology availability notes', () => {
  const report = reportModel({ departmentCode: 'XRA', header: { Findings: 'First finding', Impression: 'First impression' }, details: [{ Findings: 'Second finding', Impression: 'Second impression' }] });
  assert.deepEqual(report.narratives.map((field) => field.value), ['First finding', 'First impression']);
  assert.deepEqual(report.readings[0].fields.map((field) => field.value), ['Second finding', 'Second impression']);
  const cardiology = reportModel({ departmentCode: 'HST', header: { Remarks: 'Full report available from cardiology.' }, details: [] });
  assert.equal(cardiology.narratives[0].value, 'Full report available from cardiology.');
});

test('notification identity changes with visit status and released-report revision', () => {
  const result = { examinationId: 7, departmentCode: 'LAB', department: 'Laboratory', description: 'Synthetic report', validatedDate: '2026-10-06T12:00:00' };
  const original = notificationFeed([appointment], [result], '2026-10-06');
  const changed = notificationFeed([{ ...appointment, status: 'Cancelled' }], [{ ...result, validatedDate: '2026-10-07T12:00:00' }], '2026-10-06');
  assert.ok(original[0].upcoming);
  assert.ok(changed.every((item) => !original.some((old) => old.id === item.id)));
});
