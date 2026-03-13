import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchLayers, fetchEntityInstances, sendStateEvent, type Domain } from '../api'
import { formatNounName, parseStateAddress } from '../utils'
import { LayerRenderer } from '../components/LayerRenderer'
import type { ILayer, INavigationLayer, IActionButton } from '../types'

const POLL_INTERVAL = 30000

interface Props {
  domain: Domain
  entityName: string
  /** When true, stay on the list layer — don't navigate to detail/edit/new layers */
  listOnly?: boolean
  /** Called when a list item is clicked in listOnly mode, with the resource ID */
  onSelect?: (resourceId: string) => void
  /** Currently selected resource ID (for highlight) */
  selectedId?: string | null
  /** Change this value to trigger a data refresh without resetting navigation */
  refreshKey?: number
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

export function EntityListView({ domain, entityName, listOnly, onSelect, selectedId, refreshKey }: Props) {
  const [layers, setLayers] = useState<Record<string, ILayer> | null>(null)
  const [navStack, setNavStack] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [instances, setInstances] = useState<{ resources: any[]; statuses: Map<string, string> } | null>(null)
  const CLOSED_STATUSES = ['Resolved', 'Closed']
  const statusStorageKey = `statusFilter:${domain.id}:${entityName}`
  const [statusFilter, setStatusFilter] = useState<string | null>(() => {
    if (!listOnly) return null
    const saved = sessionStorage.getItem(statusStorageKey)
    return saved !== null ? (saved || null) : 'Open'
  })
  const [searchText, setSearchText] = useState('')

  const updateStatusFilter = useCallback((value: string | null) => {
    setStatusFilter(value)
    sessionStorage.setItem(statusStorageKey, value || '')
  }, [statusStorageKey])

  const currentLayer = navStack.length > 0 ? navStack[navStack.length - 1] : null

  // Fingerprint for diffing — avoids unnecessary re-renders
  const instanceFingerprintRef = useRef('')

  const refreshInstances = useCallback(() => {
    return fetchEntityInstances(domain.id, entityName).then(inst => {
      // Build a fingerprint: resource ids + statuses
      const fp = inst.resources.map(r => `${r.id}:${r.reference}:${r.value}:${inst.statuses.get(r.id) || ''}`).join('|')
      if (fp !== instanceFingerprintRef.current) {
        instanceFingerprintRef.current = fp
        setInstances(inst)
      }
    })
  }, [domain.id, entityName])

  const refreshData = useCallback((resetNav = true) => {
    const slug = domain.domainSlug || domain.slug
    return Promise.all([
      fetchLayers(slug),
      refreshInstances(),
    ]).then(([l]) => {
      const layers = l as Record<string, ILayer>
      setLayers(layers)
      if (resetNav) {
        const initial = findLayerKey(Object.keys(layers), entityName)
        setNavStack(initial ? [initial] : [])
      }
    })
  }, [domain.domainSlug, domain.slug, entityName, refreshInstances])

  useEffect(() => {
    setLoading(true)
    setError(null)
    refreshData(true)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [refreshData])

  // Re-fetch data (without nav reset) when refreshKey changes
  useEffect(() => {
    if (refreshKey) {
      refreshInstances().catch(e => setError(e.message))
    }
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll for instance changes — only when tab is visible
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | null = null
    const start = () => {
      if (!timer) timer = setInterval(() => refreshInstances().catch(() => {}), POLL_INTERVAL)
    }
    const stop = () => {
      if (timer) { clearInterval(timer); timer = null }
    }
    const onVisibility = () => document.hidden ? stop() : start()
    if (!document.hidden) start()
    document.addEventListener('visibilitychange', onVisibility)
    return () => { stop(); document.removeEventListener('visibilitychange', onVisibility) }
  }, [refreshInstances])

  // Collect unique statuses for filtering
  const availableStatuses = useMemo(() => {
    if (!instances) return []
    const statuses = new Set<string>()
    for (const s of instances.statuses.values()) {
      if (s) statuses.add(s)
    }
    return Array.from(statuses).sort()
  }, [instances])

  // Hydrate list layers with actual resource data
  const hydratedLayers = useMemo(() => {
    if (!layers) return layers
    if (!instances || instances.resources.length === 0) return layers
    const result = { ...layers }
    for (const [key, layer] of Object.entries(result)) {
      if (layer.type !== 'layer') continue
      const navLayer = layer as INavigationLayer
      // Hydrate any list layer that has empty items
      const hasEmptyList = navLayer.items.length > 0 && navLayer.items[0].items.length === 0
      if (!hasEmptyList) continue

      // Filter by status if active
      const filtered = statusFilter === 'Open'
        ? instances.resources.filter(r => !CLOSED_STATUSES.includes(instances.statuses.get(r.id) || ''))
        : statusFilter === 'Closed'
          ? instances.resources.filter(r => CLOSED_STATUSES.includes(instances.statuses.get(r.id) || ''))
          : instances.resources

      result[key] = {
        ...navLayer,
        items: [{
          type: 'list' as const,
          items: filtered.map(r => ({
            text: r.reference || r.value || r.id,
            subtext: r.value && r.reference ? r.value : undefined,
            address: `/${key}/${r.id}`,
            status: instances.statuses.get(r.id),
          })),
        }],
        searchBox: { placeholder: `Search ${formatNounName(entityName)}s...` },
      }
    }
    return result
  }, [layers, instances, entityName, statusFilter])

  const handleNavigate = useCallback((address: string) => {
    if (!hydratedLayers) return
    // In listOnly mode, extract resource ID and call onSelect instead of navigating
    if (listOnly) {
      if (onSelect && address) {
        // Address format: /SupportRequests/{id}
        const segments = address.replace(/^\//, '').split('/')
        if (segments.length >= 2) onSelect(segments[segments.length - 1])
      }
      return
    }
    const target = resolveAddress(address, Object.keys(hydratedLayers))
    if (target) {
      setNavStack(prev => {
        const idx = prev.indexOf(target)
        if (idx >= 0) return prev.slice(0, idx + 1)
        return [...prev, target]
      })
    }
  }, [hydratedLayers, listOnly, onSelect])

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

    if (btn.action === 'edit' && hydratedLayers) {
      const keys = Object.keys(hydratedLayers)
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

  if (loading) return <div className="p-4 text-muted-foreground">Loading...</div>
  if (error) return <div className="p-4 bg-destructive/10 border border-destructive/30 rounded-lg text-destructive">{error}</div>

  const displayName = formatNounName(entityName)

  if (!hydratedLayers || !currentLayer || !hydratedLayers[currentLayer]) {
    return (
      <div className={listOnly ? 'p-4' : 'max-w-2xl mx-auto'}>
        <h1 className="text-xl font-bold text-foreground font-display mb-4">{displayName}</h1>
        <p className="text-muted-foreground">No iLayer view found for "{displayName}".</p>
      </div>
    )
  }

  const layer = hydratedLayers[currentLayer]
  const canGoBack = navStack.length > 1

  // Master pane mode: compact list with status filter and scroll
  if (listOnly) {
    const searchPlaceholder = (layer as any).searchBox?.placeholder || `Search ${displayName}s...`
    const actionButtons: IActionButton[] = (layer as any).actionButtons || []
    return (
      <div className="flex flex-col h-full overflow-hidden">
        {/* Search bar + new button */}
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
          {actionButtons.map((btn, i) => (
            <button
              key={i}
              onClick={() => handleAction(btn)}
              title={formatNounName(btn.text)}
              className="flex-shrink-0 p-2 border border-input rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
          ))}
        </div>
        {/* Status filter pills */}
        {availableStatuses.length > 0 && (
          <div className="flex gap-1 px-3 py-2 border-b border-border overflow-x-auto shrink-0">
            <button
              onClick={() => updateStatusFilter('Open')}
              className={`text-xs px-2 py-1 rounded-full whitespace-nowrap transition-colors ${
                statusFilter === 'Open' ? 'bg-primary-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => updateStatusFilter('Closed')}
              className={`text-xs px-2 py-1 rounded-full whitespace-nowrap transition-colors ${
                statusFilter === 'Closed' ? 'bg-primary-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Closed
            </button>
            <button
              onClick={() => updateStatusFilter(null)}
              className={`text-xs px-2 py-1 rounded-full whitespace-nowrap transition-colors ${
                !statusFilter ? 'bg-primary-600 text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
          </div>
        )}
        {/* Scrollable list */}
        <div className="flex-1 overflow-y-auto">
          <LayerRenderer layer={layer} onNavigate={handleNavigate} onAction={handleAction} selectedId={selectedId} hideSearchBox externalSearchText={searchText} />
        </div>
      </div>
    )
  }

  // Full page mode (non-sidebar)
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
