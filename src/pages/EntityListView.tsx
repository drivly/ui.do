import { useState, useEffect, useCallback } from 'react'
import { fetchLayers, sendStateEvent, type Domain } from '../api'
import { formatNounName, parseStateAddress } from '../utils'
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

export function EntityListView({ domain, entityName }: Props) {
  const [layers, setLayers] = useState<Record<string, ILayer> | null>(null)
  const [navStack, setNavStack] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const currentLayer = navStack.length > 0 ? navStack[navStack.length - 1] : null

  const refreshData = useCallback((resetNav = true) => {
    const slug = domain.domainSlug || domain.slug
    return fetchLayers(slug).then(l => {
      const layers = l as Record<string, ILayer>
      setLayers(layers)
      if (resetNav) {
        const initial = findLayerKey(Object.keys(layers), entityName)
        setNavStack(initial ? [initial] : [])
      }
    })
  }, [domain.domainSlug, domain.slug, entityName])

  useEffect(() => {
    setLoading(true)
    setError(null)
    refreshData(true)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [refreshData])

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

    // Check for state machine address (e.g. /state/Subscription/123/upgrade)
    if (address) {
      const stateInfo = parseStateAddress(address)
      if (stateInfo) {
        sendStateEvent(stateInfo.machineType, stateInfo.instanceId, stateInfo.event)
          .then(() => refreshData(false))
          .catch(e => setError(e.message))
        return
      }

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
  }, [handleNavigate, refreshData, layers, currentLayer])

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

  // All layers (list, detail, edit, create) render via LayerRenderer
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
