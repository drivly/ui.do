import { useState, useEffect, useCallback } from 'react'
import { fetchLayers, type Domain } from '../api'
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
 *
 * The {id} placeholder means "detail" — we resolve to {slug}-detail.
 */
function resolveAddress(address: string, layerKeys: string[]): string | null {
  // Strip leading slash
  const path = address.replace(/^\//, '')
  if (!path) return null

  // State machine addresses are not layers
  if (path.startsWith('state/')) return null

  const segments = path.split('/')

  if (segments.length === 1) {
    // /{slug} → try slug directly, then slug-list
    const slug = segments[0]
    return findLayer(layerKeys, slug)
  }

  if (segments.length === 2) {
    const [slug, tail] = segments
    if (tail === 'new') {
      return findLayer(layerKeys, `${slug}-new`) || findLayer(layerKeys, slug)
    }
    if (tail === 'edit' || tail === '{id}/edit') {
      return findLayer(layerKeys, `${slug}-edit`) || findLayer(layerKeys, `${slug}-detail`)
    }
    // /{slug}/{id} → detail
    return findLayer(layerKeys, `${slug}-detail`) || findLayer(layerKeys, slug)
  }

  if (segments.length === 3 && segments[2] === 'edit') {
    // /{slug}/{id}/edit → edit layer
    return findLayer(layerKeys, `${segments[0]}-edit`) || findLayer(layerKeys, `${segments[0]}-detail`)
  }

  return null
}

function findLayer(keys: string[], name: string): string | null {
  // Case-insensitive match
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

export function EntityListView({ domain, entityName }: Props) {
  const [layers, setLayers] = useState<Record<string, ILayer> | null>(null)
  const [navStack, setNavStack] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  // Current layer is top of nav stack
  const currentLayer = navStack.length > 0 ? navStack[navStack.length - 1] : null

  useEffect(() => {
    setLoading(true)
    setError(null)
    const slug = domain.domainSlug || domain.slug
    fetchLayers(slug)
      .then(l => {
        const layerMap = l as Record<string, ILayer>
        setLayers(layerMap)
        const initial = findLayerKey(Object.keys(l), entityName)
        setNavStack(initial ? [initial] : [])
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [domain.domainSlug, domain.slug, entityName])

  const handleNavigate = useCallback((address: string) => {
    if (!layers) return
    const target = resolveAddress(address, Object.keys(layers))
    if (target) {
      setNavStack(prev => {
        // If target is already in the stack, pop back to it instead of pushing
        const idx = prev.indexOf(target)
        if (idx >= 0) return prev.slice(0, idx + 1)
        return [...prev, target]
      })
    }
  }, [layers])

  const handleAction = useCallback((btn: IActionButton) => {
    // If the button has an address, navigate to it
    const address = btn.address || btn.link?.address
    if (address) {
      handleNavigate(address)
      return
    }

    // Handle action-based navigation (edit → {slug}-edit, delete → back)
    if (btn.action === 'edit' && layers) {
      const keys = Object.keys(layers)
      // Derive edit layer from current layer name (e.g., invoices-detail → invoices-edit)
      const base = currentLayer?.replace(/-detail$/, '') || ''
      const editKey = findLayer(keys, `${base}-edit`)
      if (editKey) {
        setNavStack(prev => [...prev, editKey])
        return
      }
    }

    // TODO: handle submit, create, update, delete actions
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
        <p className="text-muted-foreground">No iLayer view found for "{displayName}". Available layers:</p>
        <ul className="mt-2 space-y-1">
          {layers && Object.keys(layers).map(k => (
            <li key={k}>
              <button onClick={() => setNavStack([k])}
                className="text-primary-600 dark:text-primary-400 hover:underline text-sm">{k}</button>
            </li>
          ))}
        </ul>
      </div>
    )
  }

  const layer = layers[currentLayer]
  const canGoBack = navStack.length > 1

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
