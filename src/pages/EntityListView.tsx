import { useState, useEffect } from 'react'
import { fetchLayers, type Domain } from '../api'
import { formatNounName } from '../utils'
import { LayerRenderer } from '../components/LayerRenderer'
import type { ILayer } from '../types'

interface Props {
  domain: Domain
  entityName: string
}

function findLayerKey(keys: string[], entityName: string): string | undefined {
  const lower = entityName.toLowerCase()
  // Try exact, then with -list suffix, then plural forms (append 's')
  const candidates = [lower, `${lower}-list`, `list-${lower}`, `${lower}s`, `${lower}s-list`]
  for (const c of candidates) {
    const match = keys.find(k => k.toLowerCase() === c)
    if (match) return match
  }
  return undefined
}

export function EntityListView({ domain, entityName }: Props) {
  const [layers, setLayers] = useState<Record<string, ILayer> | null>(null)
  const [currentLayer, setCurrentLayer] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    setError(null)
    const slug = domain.domainSlug || domain.slug
    fetchLayers(slug)
      .then(l => {
        setLayers(l as Record<string, ILayer>)
        setCurrentLayer(findLayerKey(Object.keys(l), entityName) || null)
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [domain.domainSlug, domain.slug, entityName])

  const handleNavigate = (address: string) => {
    const name = address.replace(/^\/layers\//, '/').replace(/^\//, '').replace(/\/$/, '') || 'index'
    if (layers && layers[name]) setCurrentLayer(name)
  }

  if (loading) return <div className="text-muted-foreground">Loading...</div>
  if (error) return <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">{error}</div>

  const displayName = formatNounName(entityName)
  const listKey = layers ? findLayerKey(Object.keys(layers), entityName) : null

  if (!layers || !currentLayer || !layers[currentLayer]) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-foreground font-display mb-4">{displayName}</h1>
        <p className="text-muted-foreground">No iLayer view found for "{displayName}". Available layers:</p>
        <ul className="mt-2 space-y-1">
          {layers && Object.keys(layers).map(k => (
            <li key={k}>
              <button onClick={() => setCurrentLayer(k)}
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm">{k}</button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const layer = layers[currentLayer]

  return (
    <div className="max-w-2xl mx-auto">
      {listKey && currentLayer !== listKey && (
        <button onClick={() => setCurrentLayer(listKey)}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-block">
          &larr; Back to list
        </button>
      )}
      <LayerRenderer layer={layer} onNavigate={handleNavigate} />
    </div>
  )
}
