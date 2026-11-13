export type Page = 'dashboard' | 'appointments' | 'results' | 'billing' | 'profile' | 'security'

export type Session = {
  token: string
  mustChangePassword: boolean
  patient: PatientProfile
}

export type PatientProfile = {
  patientId: number
  patientNo: string
  fullName: string
  email: string
  phone?: string | null
  dateOfBirth?: string | null
  sex?: string | null
  address?: string | null
  firstName?: string | null
  lastName?: string | null
  middleName?: string | null
  streetAddress?: string | null
  province?: string | null
  municipality?: string | null
  barangay?: string | null
  zipCode?: string | null
}

export type AppointmentService = {
  id: number
  itemId: number
  description: string
  department?: string | null
  price: number
  quantity: number
}

export type Appointment = {
  id: number
  appointmentNo: string
  invoiceNumber: string
  appointmentDate: string
  branch: string
  status: string
  caseId?: number | null
  totalAmount: number
  amountPaid: number
  notes?: string | null
  services: AppointmentService[]
}

export type DiagnosticResult = {
  onlineResultId?: number | null;
  examinationId: number
  departmentCode: string
  department: string
  description: string
  resultType?: string | null
  examinationNo?: string | null
  caseNo?: string | null
  examinationDate?: string | null
  validatedDate?: string | null
  doctor?: string | null
}

export type ResultDetails = {
  departmentCode: string
  header: Record<string, unknown>
  details: Array<Record<string, unknown>>
}

export type Bill = {
  caseId: number
  caseNo?: string | null
  appointmentNo?: string | null
  soaNo?: string | null
  date?: string | null
  hospitalBill: number
  professionalFees: number
  grossAmount: number
  deductions: number
  payments: number
  amountToPay: number
  status: string
}

export type Dashboard = {
  profile: PatientProfile
  upcomingAppointments: number
  availableResults: number
  outstandingBalance: number
  nextAppointment?: Appointment | null
  recentResults: DiagnosticResult[]
}
