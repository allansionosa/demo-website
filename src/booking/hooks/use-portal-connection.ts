import { useCallback, useEffect, useRef, useState } from 'react'
import type { Session } from '../../types'
import { getPortalBookingProfile } from '../api'
import type { PortalProfile } from '../lib/patient-details'

// The booking page shares the portal session directly. No token transfer or popup.
export function usePortalConnection(session: Session | null, onSignIn: () => void, onConnected: (profile: PortalProfile) => void) {
  const [connection, setConnection] = useState<{ token: string; profile: PortalProfile } | null>(null)
  const [status, setStatus] = useState('')
  const [connecting, setConnecting] = useState(false)
  const [revision, setRevision] = useState(0)
  const account = useRef<string | null>(null)
  const callback = useRef(onConnected)
  useEffect(() => { callback.current = onConnected }, [onConnected])
  const token = session && !session.mustChangePassword ? session.token : null

  useEffect(() => {
    if (!token) return
    let active = true
    setConnecting(true)
    setStatus('Loading your verified patient profile…')
    getPortalBookingProfile(token).then(profile => {
      if (!active) return
      if (account.current && account.current !== profile.patientNo) {
        throw new Error('Sign in with the same patient account to continue this booking.')
      }
      callback.current(profile)
      account.current = profile.patientNo
      setConnection({ token, profile })
      setStatus('')
    }).catch(error => {
      if (active) setStatus(error instanceof Error ? error.message : 'Could not load your patient profile. Try again.')
    }).finally(() => { if (active) setConnecting(false) })
    return () => { active = false }
  }, [token, revision])

  const connect = useCallback(() => {
    if (!token) onSignIn()
    else setRevision(value => value + 1)
  }, [token, onSignIn])
  const verified = connection?.token === token && token !== null
  return {
    connection: verified ? connection : null,
    status,
    connecting,
    connect,
    blocked: Boolean((token && !verified) || (account.current && !verified)),
  }
}
