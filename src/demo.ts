import type { Appointment, Bill, DiagnosticResult, PatientProfile, ResultDetails, Session } from './types';
import { clinicToday, isUpcoming } from './record-tools';

// This marker identifies a browser-only fixture. It is never a backend credential.
const DEMO_TOKEN = 'browser-demo-only';
const DATA_KEY = 'patient-portal-demo-visits-v1';
export const isDemoSession = (token?: string) => token === DEMO_TOKEN;

export const demoPatient: PatientProfile = {
  patientId: -1, patientNo: 'DEMO-001', fullName: 'Alex Santos', firstName: 'Alex',
  lastName: 'Santos', middleName: 'Reyes', email: 'alex.santos@example.invalid',
  phone: 'Demo contact number', dateOfBirth: '1994-06-15', sex: 'Female',
  address: 'Sample address, Quezon City', streetAddress: 'Sample address',
  province: 'Metro Manila', municipality: 'Quezon City', barangay: 'Sample barangay', zipCode: '1100',
};

export function createDemoSession(): Session {
  return { token: DEMO_TOKEN, mustChangePassword: false, patient: demoPatient };
}

export function relativeDate(days: number) {
  const date = new Date(`${clinicToday()}T12:00:00+08:00`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export const demoServices = [
  { id: 101, name: 'Primary care consultation', category: 'Consultations', price: 600, icon: 'care', description: 'A starting point for everyday health concerns and routine follow-up visits.', duration: '30 minutes' },
  { id: 102, name: 'Complete blood count', category: 'Laboratory', price: 350, icon: 'lab', description: 'A laboratory service that can be requested by your care team.', duration: 'Visit date only' },
  { id: 103, name: 'Chest X-ray', category: 'Imaging', price: 500, icon: 'imaging', description: 'Diagnostic imaging, with released reports accessible through your portal.', duration: 'Visit date only' },
  { id: 104, name: 'Heart health consultation', category: 'Consultations', price: 900, icon: 'heart', description: 'A consultation to discuss heart health concerns with a specialist.', duration: '30 minutes' },
  { id: 105, name: 'Pediatric consultation', category: 'Consultations', price: 650, icon: 'child', description: 'A dedicated consultation for children and their families.', duration: '30 minutes' },
  { id: 106, name: 'General ultrasound', category: 'Imaging', price: 1200, icon: 'imaging', description: 'Explore a sample ultrasound booking and its visit details.', duration: 'Visit date only' },
];

const seedAppointments = (): Appointment[] => [
  { id: 1, appointmentNo: 'DEMO-VISIT-001', invoiceNumber: 'DEMO-INV-001', appointmentDate: relativeDate(3), branch: 'HIMS Demo Clinic', status: 'Confirmed', totalAmount: 600, amountPaid: 0, notes: 'Sample visit. This does not reserve a real clinic appointment.', services: [{ id: 1, itemId: 101, description: 'Primary care consultation', department: 'Consultations', price: 600, quantity: 1 }] },
  { id: 2, appointmentNo: 'DEMO-VISIT-002', invoiceNumber: 'DEMO-INV-002', appointmentDate: relativeDate(-10), branch: 'HIMS Demo Clinic', status: 'Completed', caseId: 2, totalAmount: 850, amountPaid: 850, services: [{ id: 2, itemId: 102, description: 'Complete blood count', department: 'Laboratory', price: 350, quantity: 1 }, { id: 3, itemId: 103, description: 'Chest X-ray', department: 'Imaging', price: 500, quantity: 1 }] },
];

function demoAppointments(): Appointment[] {
  try {
    const stored: unknown = JSON.parse(sessionStorage.getItem(DATA_KEY) || 'null');
    if (Array.isArray(stored) && stored.length <= 200 && stored.every(isAppointment)) return stored;
  } catch { /* Recover from unavailable or old browser demo state. */ }
  return seedAppointments();
}

function isAppointment(value: unknown): value is Appointment {
  if (!value || typeof value !== 'object') return false;
  return 'id' in value && typeof value.id === 'number' &&
    'appointmentNo' in value && typeof value.appointmentNo === 'string' &&
    'invoiceNumber' in value && typeof value.invoiceNumber === 'string' &&
    'appointmentDate' in value && typeof value.appointmentDate === 'string' &&
    'branch' in value && typeof value.branch === 'string' &&
    'status' in value && typeof value.status === 'string' &&
    'totalAmount' in value && typeof value.totalAmount === 'number' &&
    'amountPaid' in value && typeof value.amountPaid === 'number' &&
    (!('notes' in value) || value.notes === null || typeof value.notes === 'string') &&
    'services' in value && Array.isArray(value.services) && value.services.every((service: unknown) =>
      Boolean(service && typeof service === 'object' &&
        'id' in service && typeof service.id === 'number' &&
        'itemId' in service && typeof service.itemId === 'number' &&
        'description' in service && typeof service.description === 'string' &&
        'quantity' in service && typeof service.quantity === 'number' &&
        'price' in service && typeof service.price === 'number'));
}

export function saveDemoBooking(serviceId: number, date: string, notes: string, forSelf: boolean): Appointment {
  const service = demoServices.find((item) => item.id === serviceId);
  if (!service || !/^\d{4}-\d{2}-\d{2}$/.test(date) || date < clinicToday()) throw new Error('Choose a service and a visit date from today onward.');
  const visits = demoAppointments();
  if (forSelf && visits.length >= 200) throw new Error('This demo tab has reached its sample visit limit. Close the tab to start a fresh demo.');
  const id = Math.max(...visits.map((visit) => visit.id), 2) + 1;
  const reference = `DEMO-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const appointment: Appointment = {
    id, appointmentNo: reference, invoiceNumber: `DEMO-INV-${id}`, appointmentDate: date,
    branch: 'HIMS Demo Clinic', status: 'Pending', totalAmount: service.price, amountPaid: 0,
    notes: notes.trim(), services: [{ id, itemId: service.id, description: service.name.toUpperCase(), department: service.category, price: service.price, quantity: 1 }],
  };
  // Someone else's demo booking never becomes part of Alex's record.
  if (forSelf) sessionStorage.setItem(DATA_KEY, JSON.stringify([...visits, appointment]));
  return appointment;
}

function demoResults(): DiagnosticResult[] {
  return [
    { examinationId: 1, departmentCode: 'LAB', department: 'Laboratory', description: 'Complete blood count · sample report', examinationNo: 'DEMO-LAB-001', examinationDate: relativeDate(-10), validatedDate: relativeDate(-9), doctor: 'Demo care team' },
    { examinationId: 2, departmentCode: 'XRA', department: 'Radiology', description: 'Chest X-ray · sample report', examinationNo: 'DEMO-XRA-001', examinationDate: relativeDate(-10), validatedDate: relativeDate(-8), doctor: 'Demo care team' },
  ];
}

const bills: Bill[] = [
  { caseId: 1, caseNo: 'DEMO-CASE-001', soaNo: 'DEMO-SOA-001', hospitalBill: 600, professionalFees: 0, grossAmount: 600, deductions: 0, payments: 0, amountToPay: 600, status: 'Unpaid' },
  { caseId: 2, caseNo: 'DEMO-CASE-002', soaNo: 'DEMO-SOA-002', hospitalBill: 850, professionalFees: 0, grossAmount: 850, deductions: 0, payments: 850, amountToPay: 0, status: 'Paid' },
];

let demoPassword = 'DemoCare!2026';

export function demoRequest(path: string, options: RequestInit): unknown {
  const endpoint = path.replace('/api/patient-portal/', '');
  if (endpoint === 'auth/logout') { demoPassword = 'DemoCare!2026'; return undefined; }
  if (endpoint === 'auth/change-password') {
    const body: unknown = JSON.parse(typeof options.body === 'string' ? options.body : '{}');
    if (!body || typeof body !== 'object' || !('currentPassword' in body) || body.currentPassword !== demoPassword || !('newPassword' in body) || typeof body.newPassword !== 'string') throw new Error('The current demo password is incorrect. Initially use DemoCare!2026.');
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{10,}$/.test(body.newPassword)) throw new Error('Use at least 10 characters with uppercase, lowercase, a number, and a symbol.');
    demoPassword = body.newPassword;
    return { message: 'Demo password changed for this page session. Reloading or signing out resets it. No clinic account was changed.' };
  }
  if (endpoint === 'profile') return demoPatient;
  if (endpoint === 'appointments') return demoAppointments();
  if (endpoint === 'results') return demoResults();
  if (endpoint === 'bills') return bills.map((bill) => ({ ...bill, date: relativeDate(bill.caseId === 1 ? -2 : -10) }));
  if (endpoint === 'dashboard') {
    const upcoming = demoAppointments().filter((visit) => isUpcoming(visit, clinicToday())).sort((a, b) => a.appointmentDate.localeCompare(b.appointmentDate));
    return { profile: demoPatient, upcomingAppointments: upcoming.length, availableResults: 2, outstandingBalance: 600, nextAppointment: upcoming[0], recentResults: demoResults() };
  }
  if (endpoint === 'results/LAB/1' || endpoint === 'results/XRA/2') {
    const laboratory = endpoint === 'results/LAB/1';
    const details: ResultDetails = {
      departmentCode: laboratory ? 'LAB' : 'XRA',
      header: { Name: demoPatient.fullName, ExamTitle: laboratory ? 'Sample complete blood count' : 'Sample chest X-ray', Remarks: 'Fictional demonstration data. Not a medical report.', ...(laboratory ? {} : { Findings: 'Illustrative imaging narrative for the website demonstration.', Impression: 'Sample report only. No clinical interpretation.' }) },
      details: laboratory ? [{ Test: 'Hemoglobin (sample)', Result: '13.5', Unit: 'g/dL', Reference: '12.0–16.0', PrintRow: true }, { Test: 'White blood cells (sample)', Result: '6.8', Unit: '×10⁹/L', Reference: '4.0–11.0', PrintRow: true }, { Test: 'Platelets (sample)', Result: '250', Unit: '×10⁹/L', Reference: '150–400', PrintRow: true }] : [],
    };
    return details;
  }
  throw new Error('This record is not available in the demo.');
}
