import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { HeartPulse } from 'lucide-react'
import type { Session } from '../types'
import BookingFlow from './BookingFlow'
import './booking.css'

export default function BookingPage({ session, onSignIn, authentication }: {
  session: Session | null
  onSignIn: () => void
  authentication: ReactNode
}) {
  const [client] = useState(() => new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } }))
  useEffect(() => { document.title = 'Book an appointment | HIMS Patient Portal' }, [])
  return <div className="integrated-booking">
    <header className="booking-site-header">
      <a href="#/home" className="brand"><HeartPulse size={25} /><span><strong>HIMS</strong><small>Patient care</small></span></a>
      <nav aria-label="Booking navigation"><a href="#/home">Clinic website</a><a href={session ? '#/appointments' : '#/login'}>{session ? 'My appointments' : 'Patient portal'}</a></nav>
    </header>
    {authentication}
    <div hidden={Boolean(authentication)}>
      <QueryClientProvider client={client}><BookingFlow session={session} onSignIn={onSignIn} /></QueryClientProvider>
    </div>
  </div>
}
