import { useEffect, useState } from 'react';
import type { Session } from './types';

export const appointmentUrl = '#/book';
const legacyAppointmentUrl = import.meta.env.VITE_APPOINTMENT_URL || 'http://localhost:5173';

export function useBookingBridge(session: Session | null, onSessionChange: (session: Session | null) => void) {
  const [connected, setConnected] = useState(false);
  const params = new URLSearchParams(window.location.search);
  const origin = new URL(legacyAppointmentUrl, window.location.href).origin;
  const nonce = params.get('bookingNonce');
  const requestedOrigin = params.get('bookingOrigin');
  const bridgeMode = Boolean(!connected && window.opener && nonce && requestedOrigin === origin);

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (window.opener && event.source === window.opener && event.origin === origin &&
          event.data?.type === 'appointment:connected' && event.data.nonce === nonce && requestedOrigin === origin) {
        setConnected(true);
        return;
      }
      if (window.opener && event.source === window.opener && event.origin === origin &&
          event.data?.type === 'appointment:session-expired' && event.data.nonce === nonce && requestedOrigin === origin) {
        setConnected(false);
        onSessionChange(null);
        return;
      }
    };
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [session, origin, nonce, requestedOrigin, onSessionChange]);

  function continueBooking() {
    if (!bridgeMode || !session || session.mustChangePassword) return;
    window.opener.postMessage({ type: 'portal:session', nonce, token: session.token }, origin);
  }
  return { bridgeMode, continueBooking };
}
