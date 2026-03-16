import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { fetchLayers, fetchEntityInstances, sendStateEvent, fetchEntityState, type Domain, type EntityState } from '../api'
import { useLiveEvents } from '../hooks/useLiveEvents'
import { formatNounName, parseStateAddress, formatDate } from '../utils'
import { LayerRenderer } from '../components/LayerRenderer'
import type { ILayer, INavigationLayer, IActionButton } from '../types'

// Tables that trigger a refresh when changed — includes both legacy collections and 3NF entity tables
const INSTANCE_TABLES = new Set([
  'resources', 'graphs', 'resource_roles', 'state_machines', 'events',
  // 3NF entity tables use snake_case plural names derived from noun names
  // Rather than enumerating all possible entity tables, we match any table
  // that isn't a metamodel table (nouns, readings, constraints, etc.)
])
const METAMODEL_TABLES = new Set([
  'nouns', 'graph_schemas', 'readings', 'roles', 'constraints', 'constraint_spans',
  'state_machine_definitions', 'statuses', 'transitions', 'guards', 'event_types',
  'verbs', 'functions', 'streams', 'generators', 'cdc_events',
  'organizations', 'org_memberships', 'apps', 'domains',
  'models', 'agent_definitions', 'agents', 'completions', 'citations', 'graph_citations',
])

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

/** Convert PascalCase to kebab-case: SupportRequest → support-request */
function toKebab(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').replace(/([A-Z])([A-Z][a-z])/g, '$1-$2').toLowerCase()
}

// ---------------------------------------------------------------------------
// State Machine Action Bar — shown on entity detail views
// ---------------------------------------------------------------------------

const STATE_COLORS: Record<string, string> = {
  Received: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  Triaging: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
  WaitingOnCustomer: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300',
  Resolved: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  Draft: 'bg-gray-100 text-gray-800 dark:bg-gray-900/50 dark:text-gray-300',
  Sent: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
  Proposed: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300',
  Approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300',
  InProgress: 'bg-sky-100 text-sky-800 dark:bg-sky-900/50 dark:text-sky-300',
  Shipped: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300',
}

const EVENT_STYLES: Record<string, string> = {
  resolve: 'bg-green-600 hover:bg-green-700 text-white',
  close: 'bg-gray-600 hover:bg-gray-700 text-white',
  reopen: 'bg-amber-600 hover:bg-amber-700 text-white',
  triage: 'bg-blue-600 hover:bg-blue-700 text-white',
  send: 'bg-green-600 hover:bg-green-700 text-white',
  approve: 'bg-blue-600 hover:bg-blue-700 text-white',
  start: 'bg-sky-600 hover:bg-sky-700 text-white',
  ship: 'bg-green-600 hover:bg-green-700 text-white',
  reject: 'bg-red-600 hover:bg-red-700 text-white',
}

function EntityStateBar({ entityName, entityId, onStateChange }: {
  entityName: string
  entityId: string
  onStateChange?: () => void
}) {
  const [state, setState] = useState<EntityState | null>(null)
  const [acting, setActing] = useState(false)

  const loadState = useCallback(async () => {
    const s = await fetchEntityState(entityName, entityId)
    setState(s)
  }, [entityName, entityId])

  useEffect(() => {
    setState(null)
    loadState()
  }, [loadState])

  const handleEvent = useCallback(async (event: string) => {
    setActing(true)
    try {
      await sendStateEvent(entityName, entityId, event)
      await loadState()
      onStateChange?.()
    } finally {
      setActing(false)
    }
  }, [entityName, entityId, loadState, onStateChange])

  if (!state?.currentState) return null

  const statusColor = STATE_COLORS[state.currentState] || 'bg-muted text-muted-foreground'
  const transitions = state.availableTransitions || []
  const events = transitions.length > 0
    ? transitions.map(t => t.event)
    : (state.availableEvents || [])
  // Deduplicate events
  const uniqueEvents = [...new Set(events)]

  return (
    <div className="flex items-center gap-2 mb-4 px-1">
      <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${statusColor}`}>
        {formatNounName(state.currentState)}
      </span>
      <div className="flex-1" />
      {uniqueEvents.map(event => {
        const style = EVENT_STYLES[event] || 'bg-primary-600 hover:bg-primary-700 text-white'
        return (
          <button
            key={event}
            onClick={() => handleEvent(event)}
            disabled={acting}
            className={`text-xs px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-50 ${style}`}
          >
            {formatNounName(event)}
          </button>
        )
      })}
    </div>
  )
}

function findLayerKey(keys: string[], entityName: string): string | undefined {
  const lower = entityName.toLowerCase()
  const kebab = toKebab(entityName)
  const candidates = [
    lower, kebab, `${kebab}s`,
    `${lower}-list`, `${kebab}-list`, `${kebab}s-list`,
    `list-${lower}`, `list-${kebab}`,
    `${lower}s`, `${lower}s-list`,
  ]
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
  const [detailEntityId, setDetailEntityId] = useState<string | null>(null)

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

  // Clear selection if the selected entity was deleted (checked after each refresh)
  useEffect(() => {
    if (selectedId && instances && !instances.resources.some(r => r.id === selectedId)) {
      onSelect?.('')
    }
  }, [instances, selectedId, onSelect])

  const domainSlug = domain.domainSlug || domain.slug
  const refreshData = useCallback((resetNav = true) => {
    return Promise.all([
      fetchLayers(domainSlug),
      refreshInstances(),
    ]).then(([l]) => {
      const layers = l as Record<string, ILayer>
      setLayers(layers)
      if (resetNav) {
        const initial = findLayerKey(Object.keys(layers), entityName)
        setNavStack(initial ? [initial] : [])
      }
    })
  }, [domainSlug, entityName, refreshInstances])

  useEffect(() => {
    // Only show loading on initial mount, not on re-fetches
    if (!layers) setLoading(true)
    setError(null)
    refreshData(!layers)
      .catch(e => setError(e.message))
      .finally(() => setLoading(false))
  }, [refreshData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Re-fetch data (without nav reset) when refreshKey changes
  useEffect(() => {
    if (refreshKey) {
      refreshInstances().catch(e => setError(e.message))
    }
  }, [refreshKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Live event stream — refresh instances when data changes (replaces polling)
  useLiveEvents(domain.id, useCallback((event) => {
    // Refresh on any table change that isn't a metamodel definition table
    if (INSTANCE_TABLES.has(event.table) || !METAMODEL_TABLES.has(event.table)) {
      refreshInstances().catch(() => {})
    }
  }, [refreshInstances]))

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
    const result = { ...layers }
    for (const [key, layer] of Object.entries(result)) {
      if (layer.type !== 'layer') continue
      const navLayer = layer as INavigationLayer
      // Detect template layers: items with {placeholder} patterns in text/subtext/address
      const firstList = navLayer.items[0]
      if (!firstList || firstList.type !== 'list') continue
      const isTemplate = firstList.items.length === 0 ||
        firstList.items.some((item: any) =>
          item.subtext?.includes('{') || item.text?.includes('{') || item.address?.includes('{'))
      if (!isTemplate) continue

      // Replace templates with live resource data (or empty list if no instances)
      const resources = instances?.resources || []
      const statuses = instances?.statuses || new Map()
      const filtered = statusFilter === 'Open'
        ? resources.filter(r => !CLOSED_STATUSES.includes(statuses.get(r.id) || ''))
        : statusFilter === 'Closed'
          ? resources.filter(r => CLOSED_STATUSES.includes(statuses.get(r.id) || ''))
          : statusFilter && statusFilter !== 'All'
            ? resources.filter(r => statuses.get(r.id) === statusFilter)
            : resources

      // Display field mapping from iLayer — derived from domain readings by the generator
      const { primary: primaryField, secondary: secondaryField, date: dateField } =
        (navLayer as any).displayFields || {} as { primary?: string; secondary?: string; date?: string }
      const gridCellTemplate = (navLayer as any).gridCell as
        { rows: number; columns: number; elements: Array<{ field: string; row: number; column: number; columnSpan?: number; horizontalAlignment?: string; style?: string; format?: string }> } | undefined // alignment types are cast at render time

      result[key] = {
        ...navLayer,
        items: [{
          type: 'list' as const,
          items: filtered.map(r => {
            // Resolve display values from the iLayer-declared field mapping
            const text = (primaryField && r[primaryField]) || r.reference || r.id
            const subtext = secondaryField ? r[secondaryField] : undefined
            const dateVal = dateField ? r[dateField] : r.createdAt

            // Build grid cell by resolving element field values from entity data
            const grid = gridCellTemplate ? {
              ...gridCellTemplate,
              elements: gridCellTemplate.elements.map(el => ({
                ...el,
                value: el.format === 'date' && r[el.field]
                  ? formatDate(r[el.field])
                  : r[el.field] || '',
              })),
              address: `/${key}/${r.id}`,
              metadata: { id: r.id, status: statuses.get(r.id) || '' },
            } : undefined

            return {
              text,
              subtext,
              date: dateVal ? formatDate(dateVal) : undefined,
              address: `/${key}/${r.id}`,
              status: statuses.get(r.id),
              grid,
            }
          }),
        }],
        searchBox: (navLayer as any).searchBox || { placeholder: `Search ${formatNounName(entityName)}s...` },
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
      // Extract entity ID from address when navigating to a detail layer
      const segments = address.replace(/^\//, '').split('/')
      if (target.endsWith('-detail') && segments.length >= 2) {
        setDetailEntityId(segments[segments.length - 1])
      } else if (!target.endsWith('-detail')) {
        setDetailEntityId(null)
      }
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
    setNavStack(prev => {
      if (prev.length <= 1) return prev
      const next = prev.slice(0, -1)
      // Clear entity ID if we're leaving a detail layer
      if (!next[next.length - 1]?.endsWith('-detail')) {
        setDetailEntityId(null)
      }
      return next
    })
  }, [])

  // Loading state renders inline — never replace the whole component tree
  // if (loading) return <div className="p-4 text-muted-foreground">Loading...</div>
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
  const isDetailView = currentLayer.endsWith('-detail') && !!detailEntityId

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
            {availableStatuses.length > 2 && (
              <>
                <span className="text-border mx-0.5">|</span>
                {availableStatuses.map(status => {
                  const color = STATE_COLORS[status] || 'bg-muted text-muted-foreground'
                  const isActive = statusFilter === status
                  return (
                    <button
                      key={status}
                      onClick={() => updateStatusFilter(isActive ? 'Open' : status)}
                      className={`text-xs px-2 py-1 rounded-full whitespace-nowrap transition-colors ${
                        isActive ? color : 'bg-muted/50 text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {formatNounName(status)}
                    </button>
                  )
                })}
              </>
            )}
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
      {isDetailView && (
        <EntityStateBar
          entityName={entityName}
          entityId={detailEntityId!}
          onStateChange={() => refreshData(false).catch(e => setError(e.message))}
        />
      )}
      <LayerRenderer layer={layer} onNavigate={handleNavigate} onAction={handleAction} />
    </div>
  )
}
