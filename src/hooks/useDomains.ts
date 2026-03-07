import { useState, useEffect } from 'react'
import { fetchDomains, type Domain } from '../api'

export function useDomains() {
  const [domains, setDomains] = useState<Domain[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchDomains()
      .then(setDomains)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  const refresh = () => {
    setLoading(true)
    fetchDomains()
      .then(setDomains)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }

  return { domains, loading, error, refresh }
}
