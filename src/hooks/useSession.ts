import { useState, useEffect } from 'react'
import { fetchSession, type Session } from '../api'

const ADMIN_DOMAINS = ['driv.ly', 'repo.do']

export function useSession() {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSession()
      .then(setSession)
      .catch(() => setSession(null))
      .finally(() => setLoading(false))
  }, [])

  const isAdmin = session?.admin || ADMIN_DOMAINS.some(d => session?.email?.endsWith(`@${d}`))

  return { session, isAdmin, loading }
}
