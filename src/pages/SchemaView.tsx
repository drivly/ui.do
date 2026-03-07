import { useState, useEffect } from 'react'
import { fetchReadings, fetchNouns, fetchConstraints, type Domain, type Reading, type Noun, type Constraint } from '../api'
import { formatNounName, formatDomainLabel } from '../utils'

interface Props {
  domain: Domain
}

export function SchemaView({ domain }: Props) {
  const [readings, setReadings] = useState<Reading[]>([])
  const [nouns, setNouns] = useState<Noun[]>([])
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchReadings(domain.id).catch(() => [] as Reading[]),
      fetchNouns(domain.id).catch(() => [] as Noun[]),
      fetchConstraints(domain.id).catch(() => [] as Constraint[]),
    ])
      .then(([r, n, c]) => { setReadings(r); setNouns(n); setConstraints(c) })
      .finally(() => setLoading(false))
  }, [domain.id])

  const label = formatDomainLabel(domain)

  if (loading) return <div className="text-muted-foreground">Loading schema...</div>

  const nounNames = new Set(nouns.map(n => n.name))
  const grouped: Record<string, Reading[]> = {}
  const ungrouped: Reading[] = []

  for (const r of readings) {
    let matched = false
    for (const name of nounNames) {
      if (r.text.includes(name)) {
        if (!grouped[name]) grouped[name] = []
        grouped[name].push(r)
        matched = true
        break
      }
    }
    if (!matched) ungrouped.push(r)
  }

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-foreground font-display mb-1">{label}</h1>
      <p className="text-sm text-muted-foreground mb-6">{readings.length} readings, {nouns.length} entities{constraints.length > 0 ? `, ${constraints.length} constraints` : ''}</p>

      {nouns.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Entity Types</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {nouns.map(n => (
              <div key={n.id} className="bg-card border border-border rounded-lg px-3 py-2">
                <div className="text-sm font-medium text-card-foreground">{formatNounName(n.name)}</div>
                {n.plural && <div className="text-xs text-muted-foreground">{n.plural}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {(Object.keys(grouped).length > 0 || ungrouped.length > 0) && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Readings</h2>
          {Object.entries(grouped).map(([entity, entityReadings]) => (
            <div key={entity} className="mb-4">
              <h3 className="text-sm font-medium text-foreground mb-1">{formatNounName(entity)}</h3>
              <ul className="space-y-1">
                {entityReadings.map(r => (
                  <li key={r.id} className="text-sm text-muted-foreground bg-card border border-border rounded px-3 py-1.5 font-mono">
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {ungrouped.length > 0 && (
            <div className="mb-4">
              <h3 className="text-sm font-medium text-foreground mb-1">Other</h3>
              <ul className="space-y-1">
                {ungrouped.map(r => (
                  <li key={r.id} className="text-sm text-muted-foreground bg-card border border-border rounded px-3 py-1.5 font-mono">
                    {r.text}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {constraints.length > 0 && (
        <section>
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Constraints</h2>
          <ul className="space-y-1">
            {constraints.map(c => (
              <li key={c.id} className="text-sm bg-card border border-border rounded px-3 py-1.5 flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                  c.modality === 'Deontic' ? 'bg-primary-100 text-primary-700 dark:bg-primary-950 dark:text-primary-400' : 'bg-secondary-100 text-secondary-700 dark:bg-secondary-950 dark:text-secondary-400'
                }`}>{c.kind}</span>
                <span className="text-muted-foreground">{c.title || c.kind}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
