import { useState, useEffect } from 'react'
import { fetchReadings, fetchNouns, fetchConstraints, type Domain, type Reading, type Noun, type Constraint } from '../api'

interface Props {
  domain: Domain
}

export function UoDView({ domain }: Props) {
  const [readings, setReadings] = useState<Reading[]>([])
  const [nouns, setNouns] = useState<Noun[]>([])
  const [constraints, setConstraints] = useState<Constraint[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetchReadings(domain.id),
      fetchNouns(domain.id),
      fetchConstraints(domain.id),
    ])
      .then(([r, n, c]) => { setReadings(r); setNouns(n); setConstraints(c) })
      .finally(() => setLoading(false))
  }, [domain.id])

  if (loading) return <div className="text-gray-500">Loading schema...</div>

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
      <h1 className="text-xl font-bold text-gray-900 mb-1">Universe of Discourse</h1>
      <p className="text-sm text-gray-500 mb-6">{domain.title || domain.slug} — {readings.length} readings, {nouns.length} entities, {constraints.length} constraints</p>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Entity Types</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {nouns.map(n => (
            <div key={n.id} className="bg-white border rounded-lg px-3 py-2">
              <div className="text-sm font-medium text-gray-900">{n.name}</div>
              {n.plural && <div className="text-xs text-gray-400">{n.plural}</div>}
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Fact Types</h2>
        {Object.entries(grouped).map(([entity, entityReadings]) => (
          <div key={entity} className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-1">{entity}</h3>
            <ul className="space-y-1">
              {entityReadings.map(r => (
                <li key={r.id} className="text-sm text-gray-600 bg-white border rounded px-3 py-1.5 font-mono">
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        ))}
        {ungrouped.length > 0 && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-700 mb-1">Other</h3>
            <ul className="space-y-1">
              {ungrouped.map(r => (
                <li key={r.id} className="text-sm text-gray-600 bg-white border rounded px-3 py-1.5 font-mono">
                  {r.text}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {constraints.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Constraints</h2>
          <ul className="space-y-1">
            {constraints.map(c => (
              <li key={c.id} className="text-sm bg-white border rounded px-3 py-1.5 flex items-center gap-2">
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${
                  c.modality === 'Deontic' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                }`}>{c.kind}</span>
                <span className="text-gray-600">{c.title || c.kind}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
