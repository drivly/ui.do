import { useState, useEffect, useCallback } from 'react'
import type { Domain, Noun, Resource } from '../api'
import { fetchLayers, fetchDashboardNoun, fetchDashboardPrefs, writeDashboardPref, deleteDashboardPref } from '../api'
import { nounDisplayName, formatDomainLabel } from '../utils'
import { LayerRenderer } from '../components/LayerRenderer'
import type { ILayer, INavigationLayer } from '../types'
import { parseDashboardConfig, serializeSection, serializeWidget, SectionRenderer, WidgetPicker } from '../dashboard'
import type { DashboardConfig, WidgetType } from '../dashboard'
import { defaultRegistry } from '../components/converter'

type View = { type: 'dashboard' } | { type: 'entity'; noun: string } | { type: 'schema' } | { type: 'uod' } | { type: 'build' }

interface Props {
  domain: Domain
  nouns: Noun[]
  isAdmin: boolean
  onNavigate: (view: View) => void
}

/** Parse a dashboard preference value like "pins Customer" or "hides Order" */
function parsePref(value: string): { action: string; target: string } | null {
  const match = value.match(/^(pins|hides|reorders)\s+(.+?)(?:\s+to\s+(\d+))?$/)
  if (!match) return null
  return { action: match[1], target: match[2] }
}

/** Apply user preferences to the index navigation layer */
function applyPrefs(layer: INavigationLayer, prefs: Resource[]): INavigationLayer {
  if (!prefs.length) return layer

  const hidden = new Set<string>()
  const pinned = new Set<string>()
  const reorders = new Map<string, number>()

  for (const pref of prefs) {
    const parsed = parsePref(pref.value || '')
    if (!parsed) continue
    if (parsed.action === 'hides') hidden.add(parsed.target)
    if (parsed.action === 'pins') pinned.add(parsed.target)
    if (parsed.action === 'reorders') {
      const m = (pref.value || '').match(/to\s+(\d+)$/)
      if (m) reorders.set(parsed.target, parseInt(m[1]))
    }
  }

  const patchedItems = layer.items.map(list => ({
    ...list,
    items: list.items
      .filter(item => !hidden.has(item.text))
      .sort((a, b) => {
        const aPin = pinned.has(a.text) ? 0 : 1
        const bPin = pinned.has(b.text) ? 0 : 1
        if (aPin !== bPin) return aPin - bPin
        const aOrder = reorders.get(a.text) ?? Infinity
        const bOrder = reorders.get(b.text) ?? Infinity
        return aOrder - bOrder
      }),
  }))

  return { ...layer, items: patchedItems }
}

export function DashboardView({ domain, nouns, isAdmin, onNavigate }: Props) {
  const [indexLayer, setIndexLayer] = useState<ILayer | null>(null)
  const [layerError, setLayerError] = useState(false)
  const [dashboardNoun, setDashboardNoun] = useState<Noun | null>(null)
  const [prefs, setPrefs] = useState<Resource[]>([])
  const [editing, setEditing] = useState(false)
  const [layers, setLayers] = useState<Record<string, ILayer>>({})
  const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null)
  const [pickingWidgetForSection, setPickingWidgetForSection] = useState<string | null>(null)

  const domainSlug = domain.domainSlug || domain.slug || domain.name || ''

  useEffect(() => {
    if (!domainSlug) return
    setIndexLayer(null)
    setLayerError(false)
    fetchLayers(domainSlug)
      .then(fetchedLayers => {
        setLayers(fetchedLayers as Record<string, ILayer>)
        if (fetchedLayers.index) setIndexLayer(fetchedLayers.index as ILayer)
        else setLayerError(true)
      })
      .catch(() => setLayerError(true))
  }, [domainSlug])

  // Check for Dashboard noun and fetch user preferences
  useEffect(() => {
    if (!domain.id) return
    fetchDashboardNoun(domain.id).then(noun => {
      setDashboardNoun(noun)
      if (noun) {
        fetchDashboardPrefs(domain.id, noun.id).then(setPrefs)
      }
    })
  }, [domain.id])

  useEffect(() => {
    if (prefs.length === 0) { setDashboardConfig(null); return }
    const configFacts = prefs.filter(p => {
      const v = p.value || ''
      return v.startsWith('section ') || v.startsWith('widget ') || v.startsWith('targets ')
    })
    if (configFacts.length > 0) setDashboardConfig(parseDashboardConfig(configFacts))
    else setDashboardConfig(null)
  }, [prefs])

  const togglePref = useCallback(async (action: 'pins' | 'hides', nounName: string) => {
    if (!dashboardNoun) return
    const value = `${action} ${nounName}`
    const existing = prefs.find(p => p.value === value)
    if (existing) {
      await deleteDashboardPref(existing.id)
      setPrefs(prev => prev.filter(p => p.id !== existing.id))
    } else {
      const created = await writeDashboardPref(domain.id, dashboardNoun.id, value)
      setPrefs(prev => [...prev, created])
    }
  }, [dashboardNoun, prefs, domain.id])

  const handleAddSection = useCallback(async (title: string) => {
    if (!dashboardNoun) return
    const position = dashboardConfig ? dashboardConfig.sections.length : 0
    const value = serializeSection(title, position, 3)
    const created = await writeDashboardPref(domain.id, dashboardNoun.id, value)
    setPrefs(prev => [...prev, created])
  }, [dashboardNoun, dashboardConfig, domain.id])

  const handleDeleteSection = useCallback(async (sectionId: string) => {
    const sectionPref = prefs.find(p => p.id === sectionId)
    if (!sectionPref) return
    const sectionTitle = (sectionPref.value || '').match(/^section\s+(.+?)\s+at/)?.[1]
    const widgetPrefs = prefs.filter(p => {
      const v = p.value || ''
      return v.startsWith('widget ') && v.includes(` in ${sectionTitle} at `)
    })
    await Promise.all([
      deleteDashboardPref(sectionId),
      ...widgetPrefs.map(w => deleteDashboardPref(w.id)),
    ])
    setPrefs(prev => prev.filter(p => p.id !== sectionId && !widgetPrefs.some(w => w.id === p.id)))
  }, [prefs])

  const handleAddWidget = useCallback(async (
    sectionTitle: string,
    widgetType: WidgetType,
    entity: string,
    field?: string,
    layer?: string,
  ) => {
    if (!dashboardNoun) return
    const section = dashboardConfig?.sections.find(s => s.title === sectionTitle)
    const position = section ? section.widgets.length : 0
    const value = serializeWidget(widgetType, entity, sectionTitle, position, field, layer)
    const created = await writeDashboardPref(domain.id, dashboardNoun.id, value)
    setPrefs(prev => [...prev, created])
    setPickingWidgetForSection(null)
  }, [dashboardNoun, dashboardConfig, domain.id])

  const handleDeleteWidget = useCallback(async (widgetId: string) => {
    await deleteDashboardPref(widgetId)
    setPrefs(prev => prev.filter(p => p.id !== widgetId))
  }, [])

  const isPinned = (name: string) => prefs.some(p => p.value === `pins ${name}`)
  const isHidden = (name: string) => prefs.some(p => p.value === `hides ${name}`)

  // Map layer navigation addresses back to entity views
  const handleLayerNavigate = (address: string) => {
    const slug = address.replace(/^\//, '')
    const noun = nouns.find(n =>
      n.plural === slug ||
      n.name.toLowerCase() === slug ||
      n.name === slug
    )
    if (noun) onNavigate({ type: 'entity', noun: noun.name })
  }

  // Render generated index layer with user preferences applied
  if (indexLayer && !layerError && indexLayer.type === 'layer') {
    const displayLayer = applyPrefs(indexLayer as INavigationLayer, prefs)
    const canEdit = dashboardNoun && (isAdmin || prefs.length >= 0) // Edit available when Dashboard noun exists

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground font-display">{formatDomainLabel(domain)}</h1>
            <p className="text-sm text-muted-foreground">{nouns.length} {nouns.length === 1 ? 'entity' : 'entities'}</p>
          </div>
          {canEdit && (
            <button
              onClick={() => setEditing(!editing)}
              className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                editing
                  ? 'bg-primary-600 text-white'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground'
              }`}>
              {editing ? 'Done' : 'Edit Dashboard'}
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-4">
            {/* Legacy pin/hide controls */}
            <div className="space-y-2">
              {nouns.map(n => (
                <div key={n.id}
                  className={`bg-card border rounded-lg p-4 flex items-center justify-between transition-all ${
                    isHidden(n.name) ? 'border-border opacity-50' : 'border-border'
                  }`}>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => togglePref('pins', n.name)}
                      className={`text-sm ${isPinned(n.name) ? 'text-amber-500' : 'text-muted-foreground hover:text-amber-500'}`}
                      title={isPinned(n.name) ? 'Unpin' : 'Pin to top'}>
                      {isPinned(n.name) ? '\u2605' : '\u2606'}
                    </button>
                    <span className="text-sm font-medium text-card-foreground">{nounDisplayName(n)}</span>
                  </div>
                  <button
                    onClick={() => togglePref('hides', n.name)}
                    className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                    title={isHidden(n.name) ? 'Show' : 'Hide'}>
                    {isHidden(n.name) ? 'Show' : 'Hide'}
                  </button>
                </div>
              ))}
            </div>

            {/* Section management */}
            <div className="border-t border-border pt-4">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Dashboard Sections</h3>
              {dashboardConfig?.sections.map(section => (
                <div key={section.id} className="bg-card border border-border rounded-lg p-3 mb-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-card-foreground">{section.title}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">{section.widgets.length} widget{section.widgets.length !== 1 ? 's' : ''}</span>
                      <button onClick={() => handleDeleteSection(section.id)} className="text-xs text-muted-foreground hover:text-destructive transition-colors">Delete</button>
                    </div>
                  </div>
                  {section.widgets.map(w => (
                    <div key={w.id} className="flex items-center justify-between bg-background rounded px-2 py-1 mb-1 text-xs">
                      <span className="text-card-foreground">{w.widgetType}: {w.entity}{w.field ? `.${w.field}` : ''}</span>
                      <button onClick={() => handleDeleteWidget(w.id)} className="text-muted-foreground hover:text-destructive">x</button>
                    </div>
                  ))}
                  {pickingWidgetForSection === section.title ? (
                    <WidgetPicker
                      nouns={nouns}
                      layers={layers}
                      onSelect={(type, entity, field, layer) => handleAddWidget(section.title, type, entity, field, layer)}
                      onCancel={() => setPickingWidgetForSection(null)}
                    />
                  ) : (
                    <button
                      onClick={() => setPickingWidgetForSection(section.title)}
                      className="w-full bg-background border border-dashed border-border rounded px-2 py-1 text-xs text-muted-foreground hover:border-primary-300 dark:hover:border-primary-700 transition-all mt-1"
                    >
                      + Add Widget
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => {
                  const title = prompt('Section title:')
                  if (title) handleAddSection(title)
                }}
                className="w-full bg-card border border-dashed border-border rounded-lg p-3 text-sm text-muted-foreground hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                + Add Section
              </button>
            </div>
          </div>
        ) : (
          <>
            {dashboardConfig && dashboardConfig.sections.length > 0 ? (
              dashboardConfig.sections.map(section => (
                <SectionRenderer
                  key={section.id}
                  section={section}
                  layers={layers}
                  registry={defaultRegistry}
                  onNavigate={handleLayerNavigate}
                />
              ))
            ) : (
              <LayerRenderer layer={displayLayer} onNavigate={handleLayerNavigate} />
            )}
            <button
              onClick={() => onNavigate({ type: 'schema' })}
              className="mt-3 w-full bg-card border border-dashed border-border rounded-lg p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-all">
              <div className="text-sm font-medium text-muted-foreground">Schema</div>
              <div className="text-xs text-muted-foreground mt-0.5">View readings and constraints</div>
            </button>
          </>
        )}
      </div>
    )
  }

  // Fallback: noun grid (when no generated layers exist)
  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-foreground font-display">{formatDomainLabel(domain)}</h1>
        <p className="text-sm text-muted-foreground">{nouns.length} {nouns.length === 1 ? 'entity' : 'entities'}</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {nouns.map(n => (
          <button key={n.id}
            onClick={() => onNavigate({ type: 'entity', noun: n.name })}
            className="bg-card border border-border rounded-xl p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all">
            <div className="text-sm font-medium text-card-foreground">{nounDisplayName(n)}</div>
            <div className="text-xs text-muted-foreground mt-1">View all</div>
          </button>
        ))}

        <button
          onClick={() => onNavigate({ type: 'schema' })}
          className="bg-card border border-dashed border-border rounded-xl p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 transition-all">
          <div className="text-sm font-medium text-muted-foreground">Schema</div>
          <div className="text-xs text-muted-foreground mt-1">View schema</div>
        </button>
      </div>
    </div>
  )
}
