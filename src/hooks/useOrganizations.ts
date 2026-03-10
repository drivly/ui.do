import { useState, useEffect } from 'react'
import { fetchOrganizations, type Organization } from '../api'

export function useOrganizations() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchOrganizations()
      .then(setOrgs)
      .catch(() => setOrgs([]))
      .finally(() => setLoading(false))
  }, [])

  return { orgs, loading }
}
