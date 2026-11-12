const storageKey = "appointment-confirmation-attempt"
let currentAttempt: { payload: string; requestId: string } | undefined

function createRequestId() {
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0")
  ).join("")
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}

export async function getConfirmationRequestId(payload: unknown) {
  const serialized = JSON.stringify(payload)
  if (currentAttempt?.payload === serialized) return currentAttempt.requestId

  // Persist only a digest and random ID; patient and payment data stay in memory.
  const fingerprint = crypto.subtle
    ? Array.from(
        new Uint8Array(
          await crypto.subtle.digest(
            "SHA-256",
            new TextEncoder().encode(serialized)
          )
        ),
        (byte) => byte.toString(16).padStart(2, "0")
      ).join("")
    : null

  // Another caller may have completed the same digest while this one awaited it.
  if (currentAttempt?.payload === serialized) return currentAttempt.requestId
  let requestId = createRequestId()
  if (fingerprint) {
    try {
      const saved: unknown = JSON.parse(
        sessionStorage.getItem(storageKey) || "null"
      )
      if (
        saved &&
        typeof saved === "object" &&
        "fingerprint" in saved &&
        saved.fingerprint === fingerprint &&
        "requestId" in saved &&
        typeof saved.requestId === "string" &&
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
          saved.requestId
        )
      )
        requestId = saved.requestId
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ fingerprint, requestId })
      )
    } catch {
      // Storage can be unavailable; retries within this page still reuse the ID.
    }
  }
  currentAttempt = { payload: serialized, requestId }
  return requestId
}

export function clearConfirmationAttempt() {
  currentAttempt = undefined
  try {
    sessionStorage.removeItem(storageKey)
  } catch {
    /* Storage is optional. */
  }
}
