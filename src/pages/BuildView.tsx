import { useState } from 'react'
import { bootstrapApp, extractClaims } from '../api'

interface ExtractedClaims {
  domains?: Array<{ name: string; slug: string; nouns: string[] }>
  nouns: Array<{ name: string; objectType: string; plural?: string }>
  readings: Array<{ text: string; nouns: string[]; predicate: string; multiplicity?: string }>
  constraints: Array<{ kind: string; modality: string; reading: string; roles: number[] }>
  subtypes: Array<any>
  transitions: Array<any>
  facts: Array<any>
}

interface Props {
  onComplete: (slug: string) => void
  onCancel: () => void
}

export function BuildView({ onComplete, onCancel }: Props) {
  const [slug, setSlug] = useState('')
  const [description, setDescription] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [extracted, setExtracted] = useState<ExtractedClaims | null>(null)

  const handleExtract = async () => {
    if (!description.trim()) return
    setIsExtracting(true)
    setError(null)
    setExtracted(null)

    try {
      const data = await extractClaims(description.trim())
      const claims = data.claims || data
      setExtracted(claims)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleBuild = async () => {
    if (!slug.trim() || !extracted) return
    setIsBuilding(true)
    setError(null)

    try {
      await bootstrapApp(slug.trim(), extracted)
      onComplete(slug.trim())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed')
    } finally {
      setIsBuilding(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-medium text-foreground font-display">New App</h1>
          <p className="text-sm text-muted-foreground">Describe your app in plain English</p>
        </div>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      <input
        type="text"
        placeholder="App slug (e.g. bike-rentals)"
        value={slug}
        onChange={e => setSlug(e.target.value)}
        className="w-full px-4 py-2 rounded-lg border border-border bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      <textarea
        placeholder={"Describe your app in plain English...\n\nFor example: We run a bike rental shop. Customers can rent bikes by the hour. Each bike has a model name, size, and hourly rate. We need to track which customer rented which bike, when it was rented and returned."}
        value={description}
        onChange={e => setDescription(e.target.value)}
        rows={6}
        className="w-full px-4 py-3 rounded-lg border border-border bg-card text-card-foreground text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
      />

      <button
        onClick={handleExtract}
        disabled={isExtracting || !description.trim()}
        className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isExtracting ? 'Extracting...' : 'Extract Model'}
      </button>

      {extracted && (
        <div className="space-y-4">
          {/* Domains preview */}
          {extracted.domains && extracted.domains.length > 0 && (
            <div className="p-3 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-medium text-foreground mb-2">Domains</h3>
              <div className="flex flex-wrap gap-2">
                {extracted.domains.map((d, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-primary-600/30 bg-primary-600/10 text-sm text-foreground">
                    {d.name}
                    <span className="text-xs text-muted-foreground">{d.nouns.length}</span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Nouns preview */}
          {extracted.nouns && extracted.nouns.length > 0 && (
            <div className="p-3 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-medium text-foreground mb-2">Nouns</h3>
              <div className="flex flex-wrap gap-2">
                {extracted.nouns.map((noun, i) => (
                  <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-muted text-sm text-foreground">
                    {noun.name}
                    <span className={`text-xs px-1.5 py-0.5 rounded ${
                      noun.objectType === 'entity'
                        ? 'bg-primary-600/10 text-primary-600'
                        : 'bg-muted-foreground/10 text-muted-foreground'
                    }`}>
                      {noun.objectType}
                    </span>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Readings preview */}
          {extracted.readings && extracted.readings.length > 0 && (
            <div className="p-3 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-medium text-foreground mb-2">Readings</h3>
              <ul className="space-y-1">
                {extracted.readings.map((r, i) => (
                  <li key={i} className="text-sm font-mono text-foreground/80 flex items-center gap-2">
                    <span>{r.text}</span>
                    {r.multiplicity && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{r.multiplicity}</span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Constraints preview */}
          {extracted.constraints && extracted.constraints.length > 0 && (
            <div className="p-3 rounded-lg border border-border bg-card">
              <h3 className="text-sm font-medium text-foreground mb-2">Constraints</h3>
              <ul className="space-y-1">
                {extracted.constraints.map((c: any, i: number) => (
                  <li key={i} className="text-sm text-muted-foreground font-mono flex items-center gap-2">
                    <span className={`inline-block px-1.5 py-0.5 rounded text-xs font-semibold ${
                      c.kind === 'UC' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                    }`}>{c.kind}</span>
                    <span className="text-foreground/70">{c.reading || ''}</span>
                    {c.roles && <span className="text-muted-foreground text-xs">role{c.roles.length > 1 ? 's' : ''} {c.roles.join(', ')}</span>}
                    {c.modality === 'Deontic' && <span className="text-xs text-orange-400">(deontic)</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <button
            onClick={handleBuild}
            disabled={isBuilding || !slug.trim()}
            className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isBuilding ? 'Building...' : 'Build App'}
          </button>
        </div>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
