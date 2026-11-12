import assert from "node:assert/strict"
import { test } from "node:test"
import { initialDetails, applyPortalProfile, updateBookingDetails } from "../src/booking/lib/patient-details.ts"

const profile = {
  patientNo: "P-42", fullName: "ANA MARIA DELA CRUZ", firstName: "ANA MARIA", lastName: "DELA CRUZ",
  middleName: "PEÑA", email: "profile@example.invalid", phone: "09120000000", sex: "FEMALE",
  dateOfBirth: "1990-01-01T00:00:00", streetAddress: "12 TEST STREET", province: "TEST PROVINCE",
  municipality: "TEST CITY", barangay: "TEST BARANGAY", zipCode: "1000",
}

test("structured profile preserves compound names and converts date and sex for controls", () => {
  const details = applyPortalProfile(initialDetails, profile)
  assert.equal(details.patientFirstName, "ANA MARIA")
  assert.equal(details.patientLastName, "DELA CRUZ")
  assert.equal(details.patientDateOfBirth, "1990-01-01")
  assert.equal(details.patientSex, "Female")
  assert.equal(details.email, profile.email)
  assert.equal(details.patientProvinceAddress, profile.province)
})

test("each patient retains a separate draft, including birth date, address, notes and relationship", () => {
  let details = applyPortalProfile(initialDetails, profile)
  details = updateBookingDetails(details, "notes", "My own notes", true)
  details = updateBookingDetails(details, "attendeeType", "someone", true)
  for (const key of ["patientFirstName", "patientMiddle", "patientDateOfBirth", "patientSex", "patientStreetAddress", "notes"])
    assert.equal(details[key], "")
  details = updateBookingDetails(details, "patientFirstName", "OTHER", true)
  details = updateBookingDetails(details, "patientDateOfBirth", "2000-02-03", true)
  details = updateBookingDetails(details, "relationship", "Child", true)
  details = updateBookingDetails(details, "notes", "Other notes", true)
  details = updateBookingDetails(details, "attendeeType", "self", true)
  assert.equal(details.patientFirstName, profile.firstName)
  assert.equal(details.patientDateOfBirth, "1990-01-01")
  assert.equal(details.patientStreetAddress, profile.streetAddress)
  assert.equal(details.notes, "My own notes")
  assert.equal(details.relationship, "")
  details = updateBookingDetails(details, "attendeeType", "someone", true)
  assert.equal(details.patientFirstName, "OTHER")
  assert.equal(details.patientDateOfBirth, "2000-02-03")
  assert.equal(details.relationship, "Child")
  assert.equal(details.notes, "Other notes")
})

test("contact edits do not change a linked patient identity; connecting preserves another patient's draft", () => {
  let details = applyPortalProfile(initialDetails, profile)
  details = updateBookingDetails(details, "firstName", "BOOKER", true)
  assert.equal(details.patientFirstName, profile.firstName)
  details = updateBookingDetails(details, "attendeeType", "someone", true)
  details = updateBookingDetails(details, "patientFirstName", "OTHER", true)
  details = applyPortalProfile(details, profile)
  assert.equal(details.patientFirstName, "OTHER")
  assert.equal(details.firstName, profile.firstName)
})

test("manual self names follow the contact and never reuse another patient's birth date", () => {
  let details = updateBookingDetails(initialDetails, "firstName", "Test")
  assert.equal(details.patientFirstName, "Test")
  details = updateBookingDetails(details, "attendeeType", "someone")
  details = updateBookingDetails(details, "patientDateOfBirth", "2000-02-03")
  details = updateBookingDetails(details, "attendeeType", "self")
  assert.equal(details.patientDateOfBirth, "")
  assert.equal(details.patientFirstName, "Test")
})

test("missing structured identity is left empty instead of guessing from a display name", () => {
  const details = applyPortalProfile(initialDetails, { patientNo: "P-42", fullName: "Compound Name", email: "test@example.invalid" })
  assert.equal(details.patientFirstName, "")
  assert.equal(details.patientLastName, "")
})

