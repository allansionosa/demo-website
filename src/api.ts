import type {
  Appointment,
  Bill,
  Dashboard,
  DiagnosticResult,
  PatientProfile,
  ResultDetails,
  Session,
} from './types'
import { demoRequest, isDemoSession } from './demo'

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5160').replace(/\/$/, '')
const SESSION_KEY = 'patient-portal-session'
const expiryListeners = new Set<(token: string) => void>()

export function onSessionExpired(listener: (token: string) => void) {
  expiryListeners.add(listener)
  return () => { expiryListeners.delete(listener) }
}

type ApiErrorBody = { message?: string }

export class ApiError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

export function getStoredSession(): Session | null {
  try {
    const value = sessionStorage.getItem(SESSION_KEY)
    const parsed: unknown = value ? JSON.parse(value) : null
    if (!parsed || typeof parsed !== 'object' || !('token' in parsed) ||
        typeof parsed.token !== 'string' || !parsed.token ||
        !('mustChangePassword' in parsed) || typeof parsed.mustChangePassword !== 'boolean' ||
        !('patient' in parsed) || !parsed.patient || typeof parsed.patient !== 'object') return null
    const patient = parsed.patient
    if (!('patientId' in patient) || typeof patient.patientId !== 'number' ||
        !('patientNo' in patient) || typeof patient.patientNo !== 'string' ||
        !('fullName' in patient) || typeof patient.fullName !== 'string' ||
        !('email' in patient) || typeof patient.email !== 'string') return null
    return { token: parsed.token, mustChangePassword: parsed.mustChangePassword,
      patient: { ...patient, patientId: patient.patientId, patientNo: patient.patientNo,
        fullName: patient.fullName, email: patient.email } }
  } catch {
    return null
  }
}

export function storeSession(session: Session | null) {
  if (!session || getStoredSession()?.patient.patientId !== session.patient.patientId) {
    sessionStorage.removeItem('patient-portal-notifications')
  }
  if (session) sessionStorage.setItem(SESSION_KEY, JSON.stringify(session))
  else sessionStorage.removeItem(SESSION_KEY)
}

export async function request<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  if (isDemoSession(token)) return structuredClone(demoRequest(path, options)) as T
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    if (response.status === 401 && token && getStoredSession()?.token === token) {
      storeSession(null)
      expiryListeners.forEach((listener) => listener(token))
    }
    let body: ApiErrorBody = {}
    try {
      body = (await response.json()) as ApiErrorBody
    } catch {
      // Keep the default message for non-JSON server errors.
    }
    throw new ApiError(body.message || 'The request could not be completed.', response.status)
  }

  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

export const portalApi = {
  login: (patientNo: string, password: string) =>
    request<Session>('/api/patient-portal/auth/login', {
      method: 'POST',
      body: JSON.stringify({ patientNo, password }),
    }),
  logout: (token: string) =>
    request<void>('/api/patient-portal/auth/logout', { method: 'POST' }, token),
  forgotPassword: (patientNo: string, email: string) =>
    request<{ message: string }>('/api/patient-portal/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ patientNo, email }),
    }),
  changePassword: (token: string, currentPassword: string, newPassword: string) =>
    request<{ message: string }>('/api/patient-portal/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }, token),
  getProfile: (token: string) =>
    request<PatientProfile>('/api/patient-portal/profile', {}, token),
  getDashboard: (token: string) =>
    request<Dashboard>('/api/patient-portal/dashboard', {}, token),
  getAppointments: (token: string) =>
    request<Appointment[]>('/api/patient-portal/appointments', {}, token),
  getResults: (token: string) =>
    request<DiagnosticResult[]>('/api/patient-portal/results', {}, token),
  getResultDetails: (token: string, departmentCode: string, examinationId: number) =>
    request<ResultDetails>(
      `/api/patient-portal/results/${encodeURIComponent(departmentCode)}/${examinationId}`,
      {},
      token,
    ),
  getBills: (token: string) =>
    request<Bill[]>('/api/patient-portal/bills', {}, token),
  getNotificationRecords: async (token: string) => {
    const [appointments, results] = await Promise.all([
      portalApi.getAppointments(token), portalApi.getResults(token),
    ])
    return { appointments, results }
  },
}
