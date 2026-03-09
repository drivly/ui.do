import { useState, useEffect } from 'react'
import { fetchApps, type AppRecord } from '../api'

export function useApps() {
  const [apps, setApps] = useState<AppRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchApps()
      .then(setApps)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const refresh = () => {
    setLoading(true)
    fetchApps()
      .then(setApps)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  return { apps, loading, error, refresh }
}
