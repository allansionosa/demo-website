import { ApiError, request } from '../api'
import { getConfirmationRequestId } from './lib/confirmation-attempt'
import type { PortalProfile } from './lib/patient-details'
import { AppointmentConfirmationError, type AppointmentConfirmationPayload, type AppointmentConfirmationResponse, type BookingItem } from './contracts'

export { AppointmentConfirmationError }
export type { AppointmentConfirmationPayload, BookingItem }

const base = '/api/appointments/'
const addressQuery = (values: Record<string, string>) => new URLSearchParams(values).toString()

export const getItems = () => request<BookingItem[]>(base + 'items')
export const getProvinces = () => request<string[]>(base + 'province')
export const getProvinceCities = (province: string) => request<string[]>(base + 'province/city?' + addressQuery({ province }))
export const getCityBarangays = (province: string, city: string) => request<string[]>(base + 'province/city/brgy?' + addressQuery({ province, city }))
export const getZipcode = async (province: string, city: string, barangay: string) => String(await request<string | number>(base + 'province/city/brgy/zipcode?' + addressQuery({ province, city, barangay })) ?? '')
export const getPortalBookingProfile = (token: string) => request<PortalProfile>(base + 'portal-profile', {}, token)

async function sendConfirmation(endpoint: string, payload: AppointmentConfirmationPayload, token?: string): Promise<AppointmentConfirmationResponse> {
  try {
    const requestId = await getConfirmationRequestId(payload)
    return await request<AppointmentConfirmationResponse>(base + endpoint, {
      method: 'POST', body: JSON.stringify({ ...payload, requestId }),
    }, token)
  } catch (error) {
    throw new AppointmentConfirmationError(
      error instanceof Error ? error.message : 'Could not verify the booking. Retry this booking.',
      !(error instanceof ApiError && [400, 409, 422].includes(error.status)),
    )
  }
}

export const confirmAppointment = (payload: AppointmentConfirmationPayload, token?: string) => sendConfirmation('confirm', payload, token)
export const resendAppointmentEmail = (payload: AppointmentConfirmationPayload, token?: string) => sendConfirmation('confirm/email', payload, token)
