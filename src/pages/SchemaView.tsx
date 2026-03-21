import { useState, useEffect } from 'react'
import { fetchReadings, fetchNouns, fetchConstraints, type Domain, type Reading, type Noun, type Constraint } from '../api'
import { formatNounName, formatDomainLabel } from '../utils'

interface Props {
  domain: Domain
}

/** Walk the superType chain to find the root entity (the 3NF table owner) */
function resolveTableRoot(noun: Noun, nounById: Map<string, Noun>): string {
  const superType = noun.superType
  if (!superType) return noun.name
  const parentId = typeof superType === 'string' ? superType : superType.id
  const parent = nounById.get(parentId)
  if (!parent) return noun.name
  return resolveTableRoot(parent, nounById)
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

  // Build noun lookup by ID and name
  const nounById = new Map(nouns.map(n => [n.id, n]))
  const nounNames = new Set(nouns.map(n => n.name))

  // Determine which subtypes have exclusive readings (their own properties/table)
  // A subtype gets its own table if any reading mentions it without mentioning its supertype
  const subtypesWithExclusiveReadings = new Set<string>()
  for (const noun of nouns) {
    if (!noun.superType) continue
    const parentId = typeof noun.superType === 'string' ? noun.superType : noun.superType.id
    const parent = nounById.get(parentId)
    if (!parent) continue
    const hasExclusive = readings.some(r =>
      r.text.includes(noun.name) && !r.text.includes(parent.name)
    )
    if (hasExclusive) subtypesWithExclusiveReadings.add(noun.name)
  }

  // Map each noun → its 3NF table name
  // Subtypes without exclusive readings collapse into supertype's table
  // Subtypes with exclusive readings keep their own table
  const nounToTable = new Map<string, string>()
  for (const noun of nouns) {
    if (!noun.superType || subtypesWithExclusiveReadings.has(noun.name)) {
      nounToTable.set(noun.name, noun.name)
    } else {
      const root = resolveTableRoot(noun, nounById)
      nounToTable.set(noun.name, root)
    }
  }

  const tableNouns = new Set(nounToTable.values())

  // Collect collapsed subtypes per table root (only those without exclusive readings)
  const subtypesByTable = new Map<string, string[]>()
  for (const noun of nouns) {
    const table = nounToTable.get(noun.name)!
    if (noun.name !== table) {
      const subs = subtypesByTable.get(table) || []
      subs.push(noun.name)
      subtypesByTable.set(table, subs)
    }
  }

  // Build name list per table (root + collapsed subtypes) for reading matching — longest first
  const tableNounNames = new Map<string, string[]>()
  for (const table of tableNouns) {
    const names = [table, ...(subtypesByTable.get(table) || [])]
    names.sort((a, b) => b.length - a.length)
    tableNounNames.set(table, names)
  }

  // Group readings by table
  const grouped: Record<string, Reading[]> = {}
  const ungrouped: Reading[] = []

  for (const r of readings) {
    let matched = false
    for (const [table, names] of tableNounNames) {
      if (names.some(name => r.text.includes(name))) {
        if (!grouped[table]) grouped[table] = []
        grouped[table].push(r)
        matched = true
        break
      }
    }
    if (!matched) ungrouped.push(r)
  }

  // Sort table groups: tables with more readings first
  const sortedTables = Object.entries(grouped).sort((a, b) => b[1].length - a[1].length)

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-xl font-bold text-foreground font-display mb-1">{label}</h1>
      <p className="text-sm text-muted-foreground mb-6">{readings.length} readings, {nouns.length} entities{constraints.length > 0 ? `, ${constraints.length} constraints` : ''}</p>

      {nouns.length > 0 && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Entity Types</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {nouns.map(n => {
              const root = nounToTable.get(n.name)
              const isSubtype = root && root !== n.name
              return (
                <div key={n.id} className="bg-card border border-border rounded-lg px-3 py-2">
                  <div className="text-sm font-medium text-card-foreground">
                    {formatNounName(n.name)}
                    {isSubtype && <span className="text-xs text-muted-foreground ml-1">: {formatNounName(root)}</span>}
                  </div>
                  {n.plural && <div className="text-xs text-muted-foreground">{n.plural}</div>}
                </div>
              )
            })}
          </div>
        </section>
      )}

      {(sortedTables.length > 0 || ungrouped.length > 0) && (
        <section className="mb-8">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Readings</h2>
          {sortedTables.map(([table, tableReadings]) => {
            const subs = subtypesByTable.get(table)
            return (
              <div key={table} className="mb-4">
                <h3 className="text-sm font-medium text-foreground mb-1">
                  {formatNounName(table)}
                  {subs && subs.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-2">
                      ({subs.map(formatNounName).join(', ')})
                    </span>
                  )}
                </h3>
                <ul className="space-y-1">
                  {tableReadings.map(r => (
                    <li key={r.id} className="text-sm text-muted-foreground bg-card border border-border rounded px-3 py-1.5 font-mono">
                      {r.text}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
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
