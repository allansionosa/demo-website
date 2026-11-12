export type PortalProfile = {
  patientNo: string
  fullName: string
  email: string
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  middleName?: string | null
  dateOfBirth?: string | null
  sex?: string | null
  streetAddress?: string | null
  province?: string | null
  municipality?: string | null
  barangay?: string | null
  zipCode?: string | null
}

export type AttendeeType = "self" | "someone"

const emptyPatient = {
  patientFirstName: "",
  patientLastName: "",
  patientMiddle: "",
  patientDateOfBirth: "",
  patientSex: "",
  patientStreetAddress: "",
  patientProvinceAddress: "",
  patientMunicipalityAddress: "",
  patientBarangayAddress: "",
  patientZipCodeAddress: "",
  relationship: "",
  notes: "",
}

type PatientFields = typeof emptyPatient
export type DetailsState = PatientFields & {
  firstName: string
  lastName: string
  email: string
  phone: string
  attendeeType: AttendeeType
  notes: string
  drafts: Partial<Record<AttendeeType, PatientFields>>
}

export const initialDetails: DetailsState = {
  ...emptyPatient,
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  attendeeType: "self",
  notes: "",
  drafts: {},
}

function patientFields(details: DetailsState): PatientFields {
  return Object.fromEntries(
    Object.keys(emptyPatient).map((key) => [
      key,
      details[key as keyof PatientFields],
    ])
  ) as PatientFields
}

export function profilePatient(profile: PortalProfile): PatientFields {
  const sex = profile.sex?.toUpperCase()
  return {
    patientFirstName: profile.firstName ?? "",
    patientLastName: profile.lastName ?? "",
    patientMiddle: profile.middleName ?? "",
    patientDateOfBirth: profile.dateOfBirth?.slice(0, 10) ?? "",
    patientSex: sex === "MALE" ? "Male" : sex === "FEMALE" ? "Female" : "",
    patientStreetAddress: profile.streetAddress ?? "",
    patientProvinceAddress: profile.province ?? "",
    patientMunicipalityAddress: profile.municipality ?? "",
    patientBarangayAddress: profile.barangay ?? "",
    patientZipCodeAddress: profile.zipCode ?? "",
    relationship: "",
    notes: "",
  }
}

export function applyPortalProfile(
  details: DetailsState,
  profile: PortalProfile
): DetailsState {
  const patient = profilePatient(profile)
  return {
    ...details,
    firstName: profile.firstName ?? "",
    lastName: profile.lastName ?? "",
    email: profile.email,
    phone: profile.phone ?? "",
    ...(details.attendeeType === "self" ? patient : {}),
    drafts: { ...details.drafts, self: patient },
  }
}

export function updateBookingDetails<K extends keyof DetailsState>(
  details: DetailsState,
  key: K,
  value: DetailsState[K],
  linked = false
): DetailsState {
  if (key === "attendeeType" && value !== details.attendeeType) {
    const target = value as AttendeeType
    const patient = details.drafts[target] ?? emptyPatient
    return {
      ...details,
      ...patient,
      attendeeType: target,
      ...(target === "self" && !linked
        ? {
            patientFirstName: details.firstName,
            patientLastName: details.lastName,
            relationship: "",
          }
        : {}),
      drafts: {
        ...details.drafts,
        [details.attendeeType]: patientFields(details),
      },
    }
  }
  const next = { ...details, [key]: value }
  if (next.attendeeType === "self" && !linked) {
    if (key === "firstName") next.patientFirstName = String(value)
    if (key === "lastName") next.patientLastName = String(value)
  }
  return next
}
