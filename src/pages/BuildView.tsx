import { useState } from 'react'
import { bootstrapApp, extractClaims, fetchLayers } from '../api'
import { LayerRenderer } from '../components/LayerRenderer'
import type { ILayer } from '../types'

const EXAMPLE = `Customer has Name | *:1
Customer has Email | *:1
Customer places Order | 1:*
Order has OrderDate | *:1
Order has Status | *:1
Order contains Product | *:*
Product has ProductName | *:1
Product has Price | *:1`

type Mode = 'describe' | 'manual'

interface ExtractedClaims {
  nouns: Array<{ name: string; objectType: string; plural?: string }>
  readings: Array<{ text: string; multiplicity?: string }>
  constraints: Array<{ text?: string; kind?: string; title?: string }>
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
  const [readingsText, setReadingsText] = useState('')
  const [isBuilding, setIsBuilding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [layers, setLayers] = useState<Record<string, ILayer> | null>(null)
  const [currentLayer, setCurrentLayer] = useState('index')

  // Describe mode state
  const [mode, setMode] = useState<Mode>('describe')
  const [description, setDescription] = useState('')
  const [isExtracting, setIsExtracting] = useState(false)
  const [extracted, setExtracted] = useState<ExtractedClaims | null>(null)
  const [editedReadings, setEditedReadings] = useState('')

  const handleExtract = async () => {
    if (!description.trim()) return
    setIsExtracting(true)
    setError(null)
    setExtracted(null)

    try {
      const data = await extractClaims(description.trim())
      const claims = data.claims || data
      setExtracted(claims)
      // Auto-populate editable readings from extracted data
      const lines = (claims.readings || [])
        .map((r: { text: string; multiplicity?: string }) =>
          `${r.text}${r.multiplicity ? ' | ' + r.multiplicity : ''}`)
        .join('\n')
      setEditedReadings(lines)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
    } finally {
      setIsExtracting(false)
    }
  }

  const handleBuildFromDescribe = async () => {
    if (!slug.trim() || !editedReadings.trim()) return
    setIsBuilding(true)
    setError(null)
    setLayers(null)

    try {
      const readings = editedReadings
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const [text, mult] = line.split('|').map(s => s.trim())
          return { text, multiplicity: mult || '*:1' }
        })

      await bootstrapApp(slug.trim(), readings)
      const fetchedLayers = await fetchLayers(slug.trim())
      setLayers(fetchedLayers as Record<string, ILayer>)
      setCurrentLayer('index')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed')
    } finally {
      setIsBuilding(false)
    }
  }

  const handleBuild = async () => {
    if (!slug.trim() || !readingsText.trim()) return
    setIsBuilding(true)
    setError(null)
    setLayers(null)

    try {
      const readings = readingsText
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('#'))
        .map(line => {
          const [text, mult] = line.split('|').map(s => s.trim())
          return { text, multiplicity: mult || '*:1' }
        })

      await bootstrapApp(slug.trim(), readings)
      const fetchedLayers = await fetchLayers(slug.trim())
      setLayers(fetchedLayers as Record<string, ILayer>)
      setCurrentLayer('index')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Build failed')
    } finally {
      setIsBuilding(false)
    }
  }

  const handleNavigate = (address: string) => {
    const name = address.replace(/^\/layers\//, '/').replace(/^\//, '').replace(/\/$/, '') || 'index'
    if (layers && layers[name]) setCurrentLayer(name)
  }

  if (layers) {
    const layer = layers[currentLayer]
    return (
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-3 mb-4">
          {currentLayer !== 'index' && (
            <button onClick={() => setCurrentLayer('index')}
              className="text-sm text-muted-foreground hover:text-foreground">&larr; Back</button>
          )}
          <h1 className="text-lg font-medium text-foreground font-display">{layer?.title || currentLayer}</h1>
          <div className="flex-1" />
          <button onClick={() => onComplete(slug)}
            className="text-sm text-primary-600 hover:underline">Open in app</button>
          <button onClick={() => { setLayers(null); setCurrentLayer('index') }}
            className="text-xs text-muted-foreground hover:text-foreground underline">New app</button>
        </div>
        {layer ? (
          <LayerRenderer layer={layer} onNavigate={handleNavigate} />
        ) : (
          <p className="text-muted-foreground text-sm">Layer "{currentLayer}" not found.</p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-medium text-foreground font-display">New App</h1>
          <p className="text-sm text-muted-foreground">
            {mode === 'describe'
              ? 'Describe your domain in plain English'
              : 'Describe your domain as fact types, one per line'}
          </p>
        </div>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      {/* Mode toggle */}
      <div className="flex rounded-lg border border-border overflow-hidden">
        <button
          onClick={() => setMode('describe')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'describe'
              ? 'bg-primary-600 text-white'
              : 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          Describe
        </button>
        <button
          onClick={() => setMode('manual')}
          className={`flex-1 px-4 py-2 text-sm font-medium transition-colors ${
            mode === 'manual'
              ? 'bg-primary-600 text-white'
              : 'bg-card text-muted-foreground hover:text-foreground hover:bg-accent'
          }`}
        >
          Manual
        </button>
      </div>

      <input
        type="text"
        placeholder="Domain slug (e.g. bike-rentals)"
        value={slug}
        onChange={e => setSlug(e.target.value)}
        className="w-full px-4 py-2 rounded-lg border border-border bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

      {mode === 'describe' ? (
        <>
          <textarea
            placeholder="Describe your domain in plain English...

For example: We run a bike rental shop. Customers can rent bikes by the hour. Each bike has a model name, size, and hourly rate. We need to track which customer rented which bike, when it was rented and returned."
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

              {/* Constraints preview */}
              {extracted.constraints && extracted.constraints.length > 0 && (
                <div className="p-3 rounded-lg border border-border bg-card">
                  <h3 className="text-sm font-medium text-foreground mb-2">Constraints</h3>
                  <ul className="space-y-1">
                    {extracted.constraints.map((c, i) => (
                      <li key={i} className="text-sm text-muted-foreground font-mono">
                        {c.text || c.title || c.kind || JSON.stringify(c)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Editable readings */}
              <div className="p-3 rounded-lg border border-border bg-card">
                <h3 className="text-sm font-medium text-foreground mb-2">Readings</h3>
                <textarea
                  value={editedReadings}
                  onChange={e => setEditedReadings(e.target.value)}
                  rows={Math.max(6, editedReadings.split('\n').length + 1)}
                  className="w-full px-3 py-2 rounded-md border border-border bg-background text-card-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
                />
              </div>

              <button
                onClick={handleBuildFromDescribe}
                disabled={isBuilding || !slug.trim() || !editedReadings.trim()}
                className="w-full px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isBuilding ? 'Building...' : 'Build App'}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <textarea
            placeholder={"Entity has Property | multiplicity\ne.g. Customer has Name | *:1"}
            value={readingsText}
            onChange={e => setReadingsText(e.target.value)}
            rows={10}
            className="w-full px-4 py-3 rounded-lg border border-border bg-card text-card-foreground font-mono text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
          />

          <div className="flex gap-2">
            <button onClick={() => setReadingsText(EXAMPLE)}
              className="px-4 py-2 text-sm text-muted-foreground bg-muted rounded-lg hover:bg-accent">
              Load Example
            </button>
            <button onClick={handleBuild}
              disabled={isBuilding || !slug.trim() || !readingsText.trim()}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed">
              {isBuilding ? 'Building...' : 'Build App'}
            </button>
          </div>
        </>
      )}

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
