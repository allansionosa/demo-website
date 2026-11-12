export type AppointmentServicePayload = {
  id: number
  name: string
  category: string
  duration: string
  quantity: number
  price: number
  itemId: number
  itemDescription: string
  amount: number
  itemRecordId: number
  departmentId: number
  itemCategory: string
  categoryDescription: string
  chargesType: string
}

export type AppointmentConfirmationPayload = {
  usePortalProfile?: boolean
  portalPatientNo?: string
  email: string
  customerName: string
  phone: string
  isForSomeoneElse: boolean
  patientFirstName: string
  patientLastName: string
  patientMiddle: string
  patientDateOfBirth: string
  patientStreetAddress: string
  patientProvinceAddress: string
  patientBarangayAddress: string
  patientMunicipalityAddress: string
  patientZipCodeAddress: string
  patientSex: string
  relationship: string
  appointmentDate: string
  appointmentTime: string
  branch: string
  services: AppointmentServicePayload[]
  totalAmount: number
  amountPaid: number
  paymentType: string
  paymentMethod: string
  notes: string
}

export type AppointmentConfirmationResponse = {
  appointmentId: number
  appointmentNo: string
  appointmentCode?: string
  invoiceNumber: string
  emailSent: boolean
  emailMessage?: string
}

export class AppointmentConfirmationError extends Error {
  readonly retryable: boolean

  constructor(message: string, retryable: boolean) {
    super(message)
    this.name = "AppointmentConfirmationError"
    this.retryable = retryable
  }
}


export type BookingItem = { id: number; itemId: number; itemDescription: string; amount: number; departmentId: number; category: string; categoryDescription: string; chargesType: string }
