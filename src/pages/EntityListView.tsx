import { useState, useEffect, useCallback } from 'react'
import { fetchLayers, fetchReadings, type Domain, type Reading } from '../api'
import { formatNounName } from '../utils'
import { LayerRenderer } from '../components/LayerRenderer'
import type { ILayer, IActionButton } from '../types'

interface Props {
  domain: Domain
  entityName: string
}

/**
 * Resolve an address string to a layer key.
 *
 * Generated addresses follow these patterns:
 *   /{slug}        → list layer   (file: {slug}.json)
 *   /{slug}/{id}   → detail layer (file: {slug}-detail.json)
 *   /{slug}/new    → create layer (file: {slug}-new.json)
 *   /state/{entity}/{event} → state machine (not a layer)
 */
function resolveAddress(address: string, layerKeys: string[]): string | null {
  const path = address.replace(/^\//, '')
  if (!path) return null
  if (path.startsWith('state/')) return null

  const segments = path.split('/')

  if (segments.length === 1) {
    return findLayer(layerKeys, segments[0])
  }

  if (segments.length === 2) {
    const [slug, tail] = segments
    if (tail === 'new') return findLayer(layerKeys, `${slug}-new`) || findLayer(layerKeys, slug)
    if (tail === 'edit' || tail === '{id}/edit') return findLayer(layerKeys, `${slug}-edit`) || findLayer(layerKeys, `${slug}-detail`)
    return findLayer(layerKeys, `${slug}-detail`) || findLayer(layerKeys, slug)
  }

  if (segments.length === 3 && segments[2] === 'edit') {
    return findLayer(layerKeys, `${segments[0]}-edit`) || findLayer(layerKeys, `${segments[0]}-detail`)
  }

  return null
}

function findLayer(keys: string[], name: string): string | null {
  const match = keys.find(k => k.toLowerCase() === name.toLowerCase())
  return match || null
}

function findLayerKey(keys: string[], entityName: string): string | undefined {
  const lower = entityName.toLowerCase()
  const candidates = [lower, `${lower}-list`, `list-${lower}`, `${lower}s`, `${lower}s-list`]
  for (const c of candidates) {
    const match = keys.find(k => k.toLowerCase() === c)
    if (match) return match
  }
  return undefined
}

/** Check if a reading text contains a quoted instance (e.g., "ProviderResource 'Fly.io/load-src-do'") */
function isInstanceFact(text: string): boolean {
  return /'[^']*'/.test(text)
}

/** Filter readings that mention an entity name (case-insensitive word boundary match) */
function readingsForEntity(readings: Reading[], entityName: string): { schema: Reading[]; instances: Reading[] } {
  const re = new RegExp(`\\b${entityName}\\b`, 'i')
  const matching = readings.filter(r => re.test(r.text))
  return {
    schema: matching.filter(r => !isInstanceFact(r.text)),
    instances: matching.filter(r => isInstanceFact(r.text)),
  }
}

export function EntityListView({ domain, entityName }: Props) {
  const [layers, setLayers] = useState<Record<string, ILayer> | null>(null)
  const [navStack, setNavStack] = useState<string[]>([])
  const [readings, setReadings] = useState<Reading[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const currentLayer = navStack.length > 0 ? navStack[navStack.length - 1] : null
  const listLayer = layers ? findLayerKey(Object.keys(layers), entityName) : undefined
  const isOnListLayer = currentLayer === listLayer

  useEffect(() => {
    setLoading(true)
    setError(null)
    const slug = domain.domainSlug || domain.slug

    Promise.all([
      fetchLayers(slug).then(l => l as Record<string, ILayer>),
      fetchReadings(domain.id),
    ])
      .then(([l, r]) => {
        setLayers(l)
        setReadings(r)
        const initial = findLayerKey(Object.keys(l), entityName)
        setNavStack(initial ? [initial] : [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [domain.domainSlug, domain.slug, domain.id, entityName])

  const handleNavigate = useCallback((address: string) => {
    if (!layers) return
    const target = resolveAddress(address, Object.keys(layers))
    if (target) {
      setNavStack(prev => {
        const idx = prev.indexOf(target)
        if (idx >= 0) return prev.slice(0, idx + 1)
        return [...prev, target]
      })
    }
  }, [layers])

  const handleAction = useCallback((btn: IActionButton) => {
    const address = btn.address || btn.link?.address
    if (address) {
      handleNavigate(address)
      return
    }

    if (btn.action === 'edit' && layers) {
      const keys = Object.keys(layers)
      const base = currentLayer?.replace(/-detail$/, '') || ''
      const editKey = findLayer(keys, `${base}-edit`)
      if (editKey) {
        setNavStack(prev => [...prev, editKey])
        return
      }
    }

    console.log('Action:', btn.action, btn)
  }, [handleNavigate, layers, currentLayer])

  const handleBack = useCallback(() => {
    setNavStack(prev => prev.length > 1 ? prev.slice(0, -1) : prev)
  }, [])

  if (loading) return <div className="text-muted-foreground">Loading...</div>
  if (error) return <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">{error}</div>

  const displayName = formatNounName(entityName)

  if (!layers || !currentLayer || !layers[currentLayer]) {
    return (
      <div className="max-w-2xl mx-auto">
        <h1 className="text-xl font-bold text-foreground font-display mb-4">{displayName}</h1>
        <p className="text-muted-foreground">No iLayer view found for "{displayName}".</p>
      </div>
    )
  }

  const layer = layers[currentLayer]
  const canGoBack = navStack.length > 1

  // On the list layer, replace the template list items with readings
  if (isOnListLayer) {
    const { schema, instances } = readingsForEntity(readings, entityName)
    return (
      <div className="max-w-2xl mx-auto">
        {canGoBack && (
          <button onClick={handleBack}
            className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
            Back
          </button>
        )}

        <h1 className="text-xl font-bold text-foreground font-display mb-6">{displayName}</h1>

        {/* Schema readings (fact types) */}
        {schema.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Fact Types</h2>
            <div className="space-y-2">
              {schema.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-lg p-3 text-sm text-card-foreground">
                  {r.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Instance facts */}
        {instances.length > 0 && (
          <div className="mb-6">
            <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Instance Facts</h2>
            <div className="space-y-2">
              {instances.map(r => (
                <div key={r.id} className="bg-card border border-border rounded-lg p-3 text-sm text-card-foreground">
                  {r.text}
                </div>
              ))}
            </div>
          </div>
        )}

        {schema.length === 0 && instances.length === 0 && (
          <p className="text-muted-foreground text-sm">No readings found for {displayName}.</p>
        )}

        {/* Still show action buttons from the layer (e.g., "New Invoice") */}
        {layer.type === 'layer' && layer.actionButtons?.length ? (
          <div className="mt-4 flex gap-2">
            {layer.actionButtons.map(btn => (
              <button key={btn.id} onClick={() => handleAction(btn)}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium">
                {btn.text}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  // Non-list layers (detail, edit, create) render normally via LayerRenderer
  return (
    <div className="max-w-2xl mx-auto">
      {canGoBack && (
        <button onClick={handleBack}
          className="text-sm text-muted-foreground hover:text-foreground mb-4 inline-flex items-center gap-1">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
          Back
        </button>
      )}
      <LayerRenderer layer={layer} onNavigate={handleNavigate} onAction={handleAction} />
    </div>
  )
}
