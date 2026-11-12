export const clinicTimeZone = "Asia/Manila"
export const clinicHours =
  "Monday–Friday, 7:00 AM–4:00 PM; Saturday, 8:00 AM–4:00 PM"
export const clinicBranches = [
  "Comlogik Medical Center",
  "North Care Clinic",
  "South Procedure Suite",
]

export function getClinicNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: clinicTimeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now)
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)!.value

  return {
    date: `${value("year")}-${value("month")}-${value("day")}`,
    minutes: Number(value("hour")) * 60 + Number(value("minute")),
  }
}

export function parseDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const date = new Date(`${value}T00:00:00Z`)
  return Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
    ? null
    : date
}

export function getDateHours(value: string) {
  const date = parseDate(value)
  if (!date || date.getUTCDay() === 0) return null
  return date.getUTCDay() === 6 ? "8:00 AM–4:00 PM" : "7:00 AM–4:00 PM"
}

export function getScheduleError(value: string, now = new Date()) {
  if (!value) return "Choose an appointment date."
  if (!parseDate(value)) return "Choose a valid appointment date."
  const clinicNow = getClinicNow(now)
  if (value < clinicNow.date)
    return "Choose today or a future appointment date."
  if (!getDateHours(value))
    return "The clinic is closed on Sundays. Choose another date."
  if (value === clinicNow.date && clinicNow.minutes >= 16 * 60) {
    return "The clinic has closed for today. Choose another date."
  }
  return ""
}

export function addDays(value: string, days: number) {
  const date = parseDate(value)!
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function getNextClinicDate(now = new Date()) {
  let date = getClinicNow(now).date
  while (getScheduleError(date, now)) date = addDays(date, 1)
  return date
}

export function formatAppointmentDate(value: string) {
  const date = parseDate(value)
  return date
    ? new Intl.DateTimeFormat("en-PH", {
        timeZone: "UTC",
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
      }).format(date)
    : "Pending"
}
