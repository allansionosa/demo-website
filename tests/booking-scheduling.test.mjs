import assert from "node:assert/strict"
import { test } from "node:test"
import {
  addDays,
  formatAppointmentDate,
  getClinicNow,
  getDateHours,
  getNextClinicDate,
  getScheduleError,
  parseDate,
} from "../src/booking/lib/scheduling.ts"

test("uses Philippine time even when UTC is on the previous date", () => {
  const now = new Date("2026-10-05T16:30:00Z")
  assert.deepEqual(getClinicNow(now), { date: "2026-10-06", minutes: 30 })
  assert.match(getScheduleError("2026-10-05", now), /future/)
  assert.equal(getScheduleError("2026-10-06", now), "")
})

test("rejects malformed and impossible dates without accepting JS date rollover", () => {
  const now = new Date("2026-01-01T00:00:00Z")
  for (const value of ["2026-02-30", "2026-13-01", "2026-2-03", "invalid"]) {
    assert.equal(parseDate(value), null)
    assert.match(getScheduleError(value, now), /valid/)
  }
  assert.match(getScheduleError("", now), /Choose an appointment date/)
  assert.ok(parseDate("2028-02-29"))
  assert.equal(parseDate("2027-02-29"), null)
})

test("allows Saturdays with their own hours and rejects Sundays", () => {
  const now = new Date("2026-10-06T00:00:00Z")
  assert.equal(getScheduleError("2026-10-10", now), "")
  assert.equal(getDateHours("2026-10-10"), "8:00 AM–4:00 PM")
  assert.equal(getDateHours("2026-10-09"), "7:00 AM–4:00 PM")
  assert.equal(getDateHours("2026-10-11"), null)
  assert.match(getScheduleError("2026-10-11", now), /Sundays/)
})

test("ends same-day booking at exactly 4 PM Philippine time", () => {
  assert.equal(
    getScheduleError("2026-10-06", new Date("2026-10-06T07:59:59Z")),
    ""
  )
  assert.match(
    getScheduleError("2026-10-06", new Date("2026-10-06T08:00:00Z")),
    /closed for today/
  )
  assert.equal(
    getScheduleError("2026-10-07", new Date("2026-10-06T08:00:00Z")),
    ""
  )
})

test("finds the next clinic day across closing time, weekends and year boundaries", () => {
  assert.equal(
    getNextClinicDate(new Date("2026-10-09T07:00:00Z")),
    "2026-10-09"
  )
  assert.equal(
    getNextClinicDate(new Date("2026-10-09T08:00:00Z")),
    "2026-10-10"
  )
  assert.equal(
    getNextClinicDate(new Date("2026-10-10T08:00:00Z")),
    "2026-10-12"
  )
  assert.equal(
    getNextClinicDate(new Date("2026-10-11T00:00:00Z")),
    "2026-10-12"
  )
  assert.equal(
    getNextClinicDate(new Date("2026-12-31T08:00:00Z")),
    "2027-01-01"
  )
})

test("date arithmetic and display do not shift the selected calendar date", () => {
  assert.equal(addDays("2026-12-31", 1), "2027-01-01")
  assert.equal(addDays("2028-03-01", -1), "2028-02-29")
  assert.match(formatAppointmentDate("2026-10-06"), /6/)
  assert.match(formatAppointmentDate("2026-10-06"), /Oct/)
  assert.equal(formatAppointmentDate(""), "Pending")
})
