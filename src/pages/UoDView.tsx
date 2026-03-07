import { useState, useEffect } from 'react'
import { fetchNouns, type Domain, type Noun } from '../api'
import { formatNounName, formatDomainLabel } from '../utils'

interface Props {
  domains: Domain[]
  onSelectDomain: (id: string) => void
}

interface DomainSummary {
  domain: Domain
  nouns: Noun[]
  loading: boolean
}

export function UoDView({ domains, onSelectDomain }: Props) {
  const [summaries, setSummaries] = useState<DomainSummary[]>([])

  useEffect(() => {
    setSummaries(domains.map(d => ({ domain: d, nouns: [], loading: true })))

    domains.forEach((d, i) => {
      fetchNouns(d.id)
        .catch(() => [] as Noun[])
        .then(nouns => {
          setSummaries(prev => prev.map((s, j) => j === i ? { ...s, nouns, loading: false } : s))
        })
    })
  }, [domains])

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-foreground font-display mb-1">Domains</h1>
      <p className="text-sm text-muted-foreground mb-6">{domains.length} {domains.length === 1 ? 'domain' : 'domains'}</p>

      <div className="space-y-3">
        {summaries.map(({ domain, nouns, loading }) => (
          <button
            key={domain.id}
            onClick={() => onSelectDomain(domain.id)}
            className="w-full text-left bg-card border border-border rounded-xl p-5 hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all"
          >
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-base font-semibold text-card-foreground font-display">{formatDomainLabel(domain)}</h2>
              {loading ? (
                <span className="text-xs text-muted-foreground">loading...</span>
              ) : (
                <span className="text-xs text-muted-foreground">{nouns.length} {nouns.length === 1 ? 'entity' : 'entities'}</span>
              )}
            </div>
            {!loading && nouns.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {nouns.map(n => (
                  <span key={n.id} className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                    {formatNounName(n.name)}
                  </span>
                ))}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}
