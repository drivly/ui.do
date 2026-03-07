import { useState, useEffect } from 'react'
import { fetchNouns, type Domain, type Noun } from '../api'
import { formatNounName } from '../utils'

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

  const label = (d: Domain) => d.title || d.name || d.domainSlug || d.slug || d.id

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-xl font-bold text-gray-900 mb-1">Universe of Discourse</h1>
      <p className="text-sm text-gray-500 mb-6">{domains.length} domains under discourse</p>

      <div className="space-y-4">
        {summaries.map(({ domain, nouns, loading }) => (
          <button
            key={domain.id}
            onClick={() => onSelectDomain(domain.id)}
            className="w-full text-left bg-white border rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all"
          >
            <div className="flex items-baseline justify-between mb-2">
              <h2 className="text-base font-semibold text-gray-900">{label(domain)}</h2>
              {loading ? (
                <span className="text-xs text-gray-400">loading...</span>
              ) : (
                <span className="text-xs text-gray-400">{nouns.length} {nouns.length === 1 ? 'entity' : 'entities'}</span>
              )}
            </div>
            {!loading && nouns.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {nouns.map(n => (
                  <span key={n.id} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
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
