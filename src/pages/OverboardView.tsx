import { useState, useEffect } from 'react'
import { fetchNouns, type Domain, type Noun } from '../api'
import { nounDisplayName, formatDomainLabel } from '../utils'

type View = { type: 'dashboard' } | { type: 'entity'; noun: string } | { type: 'schema' } | { type: 'uod' } | { type: 'build' }

interface Props {
  domains: Domain[]
  appName: string
  onSelectDomain: (domainId: string) => void
  onNavigate: (view: View) => void
}

interface DomainNouns {
  domain: Domain
  nouns: Noun[]
}

export function OverboardView({ domains, appName, onSelectDomain, onNavigate }: Props) {
  const [domainNouns, setDomainNouns] = useState<DomainNouns[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all(
      domains.map(d =>
        fetchNouns(d.id).then(nouns => ({ domain: d, nouns }))
      )
    )
      .then(setDomainNouns)
      .catch(() => setDomainNouns([]))
      .finally(() => setLoading(false))
  }, [domains])

  if (loading) return <div className="text-muted-foreground">Loading...</div>

  const totalEntities = domainNouns.reduce((s, dn) => s + dn.nouns.length, 0)

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground font-display">{appName}</h1>
        <p className="text-sm text-muted-foreground">{domains.length} domains, {totalEntities} entities</p>
      </div>

      <div className="space-y-6">
        {domainNouns.map(({ domain, nouns }) => (
          <div key={domain.id}>
            <button
              onClick={() => onSelectDomain(domain.id)}
              className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3 hover:text-foreground transition-colors"
            >
              {formatDomainLabel(domain)}
            </button>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {nouns.map(n => (
                <button
                  key={n.id}
                  onClick={() => {
                    onSelectDomain(domain.id)
                    onNavigate({ type: 'entity', noun: n.name })
                  }}
                  className="bg-card border border-border rounded-lg p-3 text-left hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all"
                >
                  <div className="text-sm font-medium text-card-foreground">{nounDisplayName(n)}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{n.plural || n.name + 's'}</div>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
