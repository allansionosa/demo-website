import assert from "node:assert/strict"
import { test } from "node:test"

const storage = new Map()
globalThis.sessionStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
const { getConfirmationRequestId, clearConfirmationAttempt } =
  await import("../src/booking/lib/confirmation-attempt.ts")

const payload = {
  email: "test@example.invalid",
  appointmentDate: "2026-10-10",
  services: [1, 2],
}

test("concurrent confirmations and retries reuse one request ID", async () => {
  clearConfirmationAttempt()
  const ids = await Promise.all(
    Array.from({ length: 12 }, () => getConfirmationRequestId(payload))
  )
  assert.equal(new Set(ids).size, 1)
  assert.equal(await getConfirmationRequestId({ ...payload }), ids[0])
})

test("session storage contains a digest and random ID, without patient details", async () => {
  await getConfirmationRequestId(payload)
  const stored = [...storage.values()].join("")
  assert.ok(!stored.includes(payload.email))
  assert.ok(!stored.includes(payload.appointmentDate))
  assert.deepEqual(Object.keys(JSON.parse(stored)).sort(), [
    "fingerprint",
    "requestId",
  ])
})

test("a reload recovers the request ID for the same booking", async () => {
  const first = await getConfirmationRequestId(payload)
  const reloaded = await import("../src/booking/lib/confirmation-attempt.ts?reload")
  assert.equal(await reloaded.getConfirmationRequestId(payload), first)
})

test("changed booking details or an explicit new booking use a new ID", async () => {
  const first = await getConfirmationRequestId(payload)
  const changed = await getConfirmationRequestId({
    ...payload,
    appointmentDate: "2026-10-12",
  })
  assert.notEqual(first, changed)
  clearConfirmationAttempt()
  assert.notEqual(await getConfirmationRequestId(payload), first)
})

test("blocked storage still allows repeat submissions to reuse the in-memory ID", async () => {
  const original = globalThis.sessionStorage
  globalThis.sessionStorage = {
    getItem() {
      throw new Error("Storage disabled")
    },
    setItem() {
      throw new Error("Storage disabled")
    },
    removeItem() {
      throw new Error("Storage disabled")
    },
  }
  try {
    clearConfirmationAttempt()
    const first = await getConfirmationRequestId(payload)
    assert.equal(await getConfirmationRequestId(payload), first)
  } finally {
    globalThis.sessionStorage = original
    clearConfirmationAttempt()
  }
})
