import { useState, useEffect } from 'react'
import { fetchNouns, type Noun } from '../api'

export function useNouns(domainId: string | undefined) {
  const [nouns, setNouns] = useState<Noun[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!domainId) { setNouns([]); return }
    setLoading(true)
    fetchNouns(domainId)
      .then(setNouns)
      .catch(() => setNouns([]))
      .finally(() => setLoading(false))
  }, [domainId])

  return { nouns, loading }
}
