import { useState } from 'react'
import { bootstrapApp, fetchLayers } from '../api'
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
          <p className="text-sm text-muted-foreground">Describe your domain as fact types, one per line</p>
        </div>
        <button onClick={onCancel} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      <input
        type="text"
        placeholder="Domain slug (e.g. bike-rentals)"
        value={slug}
        onChange={e => setSlug(e.target.value)}
        className="w-full px-4 py-2 rounded-lg border border-border bg-card text-card-foreground focus:outline-none focus:ring-2 focus:ring-ring"
      />

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

      {error && (
        <div className="p-3 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
