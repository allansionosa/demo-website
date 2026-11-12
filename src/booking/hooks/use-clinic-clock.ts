import { useCallback, useEffect, useState } from "react"

export function useClinicClock() {
  const [now, setNow] = useState(() => new Date())
  const refresh = useCallback(() => setNow(new Date()), [])

  useEffect(() => {
    const interval = window.setInterval(refresh, 60_000)
    window.addEventListener("focus", refresh)
    document.addEventListener("visibilitychange", refresh)
    return () => {
      window.clearInterval(interval)
      window.removeEventListener("focus", refresh)
      document.removeEventListener("visibilitychange", refresh)
    }
  }, [refresh])

  return { now, refresh }
}
