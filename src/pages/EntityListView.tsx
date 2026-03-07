import { useState, useEffect } from 'react'
import { fetchLayers, type Domain } from '../api'
import { LayerRenderer } from '../components/LayerRenderer'
import type { ILayer } from '../types'

interface Props {
  domain: Domain
  entityName: string
}

export function EntityListView({ domain, entityName }: Props) {
  const [layers, setLayers] = useState<Record<string, ILayer> | null>(null)
  const [currentLayer, setCurrentLayer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchLayers(domain.slug)
      .then(l => {
        setLayers(l as Record<string, ILayer>)
        const listName = entityName.toLowerCase()
        const match = Object.keys(l).find(k =>
          k.toLowerCase() === listName ||
          k.toLowerCase() === `${listName}-list` ||
          k.toLowerCase() === `list-${listName}`
        )
        setCurrentLayer(match || null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [domain.slug, entityName])

  const handleNavigate = (address: string) => {
    const name = address.replace(/^\/layers\//, '/').replace(/^\//, '').replace(/\/$/, '') || 'index'
    if (layers && layers[name]) setCurrentLayer(name)
  }

  if (loading) return <div className="text-gray-500">Loading...</div>
  if (error) return <div className="p-4 bg-red-50 rounded-lg text-red-700">{error}</div>

  if (!layers || !currentLayer || !layers[currentLayer]) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-gray-900 mb-4">{entityName}</h1>
        <p className="text-gray-500">No iLayer view found for "{entityName}". Available layers:</p>
        <ul className="mt-2 space-y-1">
          {layers && Object.keys(layers).map(k => (
            <li key={k}>
              <button onClick={() => setCurrentLayer(k)}
                className="text-blue-600 hover:underline text-sm">{k}</button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const layer = layers[currentLayer]

  return (
    <div className="max-w-2xl mx-auto">
      {currentLayer !== entityName.toLowerCase() && (
        <button onClick={() => {
          const listName = entityName.toLowerCase()
          const match = layers && Object.keys(layers).find(k =>
            k.toLowerCase() === listName ||
            k.toLowerCase() === `${listName}-list` ||
            k.toLowerCase() === `list-${listName}`
          )
          if (match) setCurrentLayer(match)
        }} className="text-sm text-gray-500 hover:text-gray-900 mb-4 inline-block">
          &larr; Back to list
        </button>
      )}
      <LayerRenderer layer={layer} onNavigate={handleNavigate} />
    </div>
  )
}
