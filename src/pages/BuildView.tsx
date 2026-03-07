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
              className="text-sm text-gray-500 hover:text-gray-900">&larr; Back</button>
          )}
          <h1 className="text-lg font-medium text-gray-900">{layer?.title || currentLayer}</h1>
          <div className="flex-1" />
          <button onClick={() => onComplete(slug)}
            className="text-sm text-blue-600 hover:underline">Open in app</button>
          <button onClick={() => { setLayers(null); setCurrentLayer('index') }}
            className="text-xs text-gray-500 hover:text-gray-900 underline">New app</button>
        </div>
        {layer ? (
          <LayerRenderer layer={layer} onNavigate={handleNavigate} />
        ) : (
          <p className="text-gray-500 text-sm">Layer "{currentLayer}" not found.</p>
        )}
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-lg font-medium text-gray-900">New App</h1>
          <p className="text-sm text-gray-500">Describe your domain as fact types, one per line</p>
        </div>
        <button onClick={onCancel} className="text-sm text-gray-500 hover:text-gray-900">Cancel</button>
      </div>

      <input
        type="text"
        placeholder="Domain slug (e.g. bike-rentals)"
        value={slug}
        onChange={e => setSlug(e.target.value)}
        className="w-full px-4 py-2 rounded-lg border border-gray-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      <textarea
        placeholder={"Entity has Property | multiplicity\ne.g. Customer has Name | *:1"}
        value={readingsText}
        onChange={e => setReadingsText(e.target.value)}
        rows={10}
        className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
      />

      <div className="flex gap-2">
        <button onClick={() => setReadingsText(EXAMPLE)}
          className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
          Load Example
        </button>
        <button onClick={handleBuild}
          disabled={isBuilding || !slug.trim() || !readingsText.trim()}
          className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed">
          {isBuilding ? 'Building...' : 'Build App'}
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}
