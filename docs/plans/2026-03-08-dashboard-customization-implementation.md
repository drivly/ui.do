# Dashboard Customization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the current placeholder dashboard with a composable control surface where admins place any control from any entity's iLayer onto section-based dashboard layouts, stored as instance facts.

**Architecture:** Dashboard config is stored as Resource instance facts (same collection used for existing pin/hide prefs). A new `parseDashboardConfig()` function reads these facts into a typed section/widget tree. Each widget references an entity + field from the domain's generated iLayer. The existing `converter.ts` registry renders every widget — no new rendering code. Edit mode extends the existing toggle with section/widget CRUD and a field picker.

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, Vite, existing `api.ts` fetch helpers, existing iLayer type system (`types.ts`), existing control registry (`converter.ts`)

---

### Task 1: Dashboard Config Types and Parser

Define the TypeScript types for dashboard config (sections, widgets) and the pure function that parses Resource instance facts into the typed tree.

**Files:**
- Create: `src/dashboard/types.ts`
- Create: `src/dashboard/parser.ts`

**Step 1: Create dashboard config types**

Create `src/dashboard/types.ts`:

```typescript
/** Widget types that can be placed on the dashboard */
export type WidgetType = 'link' | 'field' | 'status-summary' | 'submission' | 'streaming' | 'remote-control'

/** A widget placed on the dashboard, referencing a control from an entity's iLayer */
export interface DashboardWidget {
  id: string              // Resource ID for persistence
  position: number
  widgetType: WidgetType
  entity: string          // entity name (noun name)
  field?: string          // field ID within the entity's iLayer
  layer?: string          // layer key (e.g. "customers", "customers-detail")
  targets?: string[]      // IDs of widgets this one controls (Widget targets Widget)
}

/** A section containing widgets */
export interface DashboardSection {
  id: string              // Resource ID for persistence
  title: string
  columnCount: number
  position: number
  widgets: DashboardWidget[]
}

/** Full parsed dashboard config */
export interface DashboardConfig {
  sections: DashboardSection[]
}
```

**Step 2: Create parser for Resource instance facts to DashboardConfig**

Create `src/dashboard/parser.ts`:

```typescript
import type { Resource } from '../api'
import type { DashboardConfig, DashboardSection, DashboardWidget, WidgetType } from './types'

/**
 * Instance fact value formats (stored in Resource.value):
 *
 * Section facts:
 *   "section <title> at <position> cols <columnCount>"
 *
 * Widget facts:
 *   "widget <widgetType> <entity> [<field>] [layer:<layer>] in <sectionTitle> at <position>"
 *
 * Targeting facts:
 *   "targets <sourceWidgetId> -> <targetWidgetId>"
 */

const SECTION_RE = /^section\s+(.+?)\s+at\s+(\d+)(?:\s+cols\s+(\d+))?$/
const WIDGET_RE = /^widget\s+(link|field|status-summary|submission|streaming|remote-control)\s+(\S+)(?:\s+(\S+))?(?:\s+layer:(\S+))?\s+in\s+(.+?)\s+at\s+(\d+)$/
const TARGET_RE = /^targets\s+(\S+)\s*->\s*(\S+)$/

export function parseDashboardConfig(resources: Resource[]): DashboardConfig {
  const sectionMap = new Map<string, DashboardSection>()
  const widgets: Array<DashboardWidget & { sectionTitle: string }> = []
  const targetings: Array<{ sourceId: string; targetId: string }> = []

  for (const res of resources) {
    const val = res.value || ''

    const sectionMatch = val.match(SECTION_RE)
    if (sectionMatch) {
      sectionMap.set(sectionMatch[1], {
        id: res.id,
        title: sectionMatch[1],
        position: parseInt(sectionMatch[2]),
        columnCount: parseInt(sectionMatch[3] || '3'),
        widgets: [],
      })
      continue
    }

    const widgetMatch = val.match(WIDGET_RE)
    if (widgetMatch) {
      widgets.push({
        id: res.id,
        widgetType: widgetMatch[1] as WidgetType,
        entity: widgetMatch[2],
        field: widgetMatch[3] || undefined,
        layer: widgetMatch[4] || undefined,
        sectionTitle: widgetMatch[5],
        position: parseInt(widgetMatch[6]),
        targets: [],
      })
      continue
    }

    const targetMatch = val.match(TARGET_RE)
    if (targetMatch) {
      targetings.push({ sourceId: targetMatch[1], targetId: targetMatch[2] })
      continue
    }
  }

  // Place widgets into their sections
  for (const w of widgets) {
    const section = sectionMap.get(w.sectionTitle)
    if (section) {
      const { sectionTitle: _, ...widget } = w
      section.widgets.push(widget)
    }
  }

  // Apply targeting relationships
  for (const { sourceId, targetId } of targetings) {
    for (const section of sectionMap.values()) {
      const source = section.widgets.find(w => w.id === sourceId)
      if (source) {
        if (!source.targets) source.targets = []
        source.targets.push(targetId)
      }
    }
  }

  // Sort sections by position, then widgets within each section by position
  const sections = [...sectionMap.values()]
    .sort((a, b) => a.position - b.position)
    .map(s => ({ ...s, widgets: s.widgets.sort((a, b) => a.position - b.position) }))

  return { sections }
}

/** Serialize a section to its instance fact value */
export function serializeSection(title: string, position: number, columnCount = 3): string {
  return `section ${title} at ${position} cols ${columnCount}`
}

/** Serialize a widget to its instance fact value */
export function serializeWidget(
  widgetType: WidgetType,
  entity: string,
  sectionTitle: string,
  position: number,
  field?: string,
  layer?: string,
): string {
  let val = `widget ${widgetType} ${entity}`
  if (field) val += ` ${field}`
  if (layer) val += ` layer:${layer}`
  val += ` in ${sectionTitle} at ${position}`
  return val
}

/** Serialize a targeting relationship */
export function serializeTarget(sourceId: string, targetId: string): string {
  return `targets ${sourceId} -> ${targetId}`
}
```

**Step 3: Verify types compile**

Run: `cd /c/Users/lippe/Repos/ui.do && npx tsc --noEmit --pretty`
Expected: No errors

**Step 4: Commit**

```bash
git add src/dashboard/types.ts src/dashboard/parser.ts
git commit -m "feat(dashboard): add config types and instance fact parser"
```

---

### Task 2: Dashboard API Functions

Add fetch/write/delete helpers for dashboard config resources to `api.ts`.

**Files:**
- Modify: `src/api.ts:247` (add after existing `deleteDashboardPref`)

**Step 1: Add updateDashboardFact to api.ts**

Add after line 247 (after `deleteDashboardPref`):

```typescript
/** Update a dashboard config fact's value */
export async function updateDashboardFact(id: string, value: string): Promise<Resource> {
  const res = await apiFetch(`/graphdl/raw/resources/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ value }),
  })
  if (!res.ok) throw new Error(`Failed to update dashboard fact: ${res.status}`)
  const data = await res.json()
  return data.doc
}
```

**Step 2: Verify types compile**

Run: `cd /c/Users/lippe/Repos/ui.do && npx tsc --noEmit --pretty`
Expected: No errors

**Step 3: Commit**

```bash
git add src/api.ts
git commit -m "feat(dashboard): add update API helper for config facts"
```

---

### Task 3: Widget Renderer Component

Create the component that takes a `DashboardWidget` + the domain's iLayer data and renders the appropriate control using the existing registry.

**Files:**
- Create: `src/dashboard/WidgetRenderer.tsx`

**Step 1: Create WidgetRenderer**

Create `src/dashboard/WidgetRenderer.tsx`:

```typescript
import type { DashboardWidget } from './types'
import type { ILayer, ILayerField, ConverterRegistry } from '../types'
import { resolveControl } from '../components/converter'
import { NavigationProvider } from '../components/NavigationContext'

interface Props {
  widget: DashboardWidget
  layers: Record<string, ILayer>
  registry: ConverterRegistry
  onNavigate?: (address: string) => void
}

/**
 * Resolves a widget's entity + field reference against the available iLayers
 * and renders the matching control from the registry.
 */
export function WidgetRenderer({ widget, layers, registry, onNavigate }: Props) {
  const handleNavigate = onNavigate || (() => {})

  // For 'link' type — render as a navigation card
  if (widget.widgetType === 'link') {
    const address = `/${widget.entity.toLowerCase()}`
    return (
      <button
        onClick={() => handleNavigate(address)}
        className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all"
      >
        <div className="text-sm font-medium text-card-foreground">{widget.entity}</div>
        <div className="text-xs text-muted-foreground mt-1">View all</div>
      </button>
    )
  }

  // For field-based widgets — find the field in the entity's layer
  const field = resolveWidgetField(widget, layers)

  if (!field) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-4">
        <div className="text-xs text-muted-foreground">
          {widget.widgetType}: {widget.entity}{widget.field ? `.${widget.field}` : ''}
          <span className="text-destructive ml-1">(field not found)</span>
        </div>
      </div>
    )
  }

  // For 'status-summary' — render the status field with a summary label
  if (widget.widgetType === 'status-summary') {
    const Control = resolveControl('status', registry)
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">{widget.entity}</div>
        <NavigationProvider value={handleNavigate}>
          <Control field={field} />
        </NavigationProvider>
      </div>
    )
  }

  // For 'submission' — render the field as an input form
  if (widget.widgetType === 'submission') {
    const Control = resolveControl(field.type, registry)
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">New {widget.entity}</div>
        <NavigationProvider value={handleNavigate}>
          <Control field={field} />
        </NavigationProvider>
      </div>
    )
  }

  // Default: render the field control directly
  const Control = resolveControl(field.type, registry)
  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="text-xs font-medium text-muted-foreground mb-2">{widget.entity}</div>
      <NavigationProvider value={handleNavigate}>
        <Control field={field} />
      </NavigationProvider>
    </div>
  )
}

/** Find the ILayerField that a widget references from the available layers */
function resolveWidgetField(widget: DashboardWidget, layers: Record<string, ILayer>): ILayerField | null {
  // Try explicit layer key first, otherwise match by entity name prefix
  const layerKeys = widget.layer
    ? [widget.layer]
    : Object.keys(layers).filter(k => k.toLowerCase().startsWith(widget.entity.toLowerCase()))

  for (const key of layerKeys) {
    const layer = layers[key]
    if (!layer) continue

    if (layer.type === 'formLayer' && widget.field) {
      for (const fs of layer.fieldsets) {
        const field = fs.fields.find(f => f.id === widget.field || f.label === widget.field)
        if (field) return field
      }
    }

    if (layer.type === 'layer' && widget.field) {
      for (const list of layer.items) {
        const item = list.items.find(i => i.text === widget.field)
        if (item) {
          return {
            id: widget.field,
            label: item.text,
            type: 'navigation',
            value: item.subtext || '',
            link: item.link || (item.address ? { address: item.address } : undefined),
          }
        }
      }
    }
  }

  // If no specific field requested, return a synthetic navigation field
  if (!widget.field) {
    return {
      id: widget.entity,
      label: widget.entity,
      type: 'navigation',
      link: { address: `/${widget.entity.toLowerCase()}` },
    }
  }

  return null
}
```

**Step 2: Verify types compile**

Run: `cd /c/Users/lippe/Repos/ui.do && npx tsc --noEmit --pretty`
Expected: No errors

**Step 3: Commit**

```bash
git add src/dashboard/WidgetRenderer.tsx
git commit -m "feat(dashboard): add WidgetRenderer component"
```

---

### Task 4: Section Renderer Component

Create the component that renders a `DashboardSection` as a titled grid of widgets.

**Files:**
- Create: `src/dashboard/SectionRenderer.tsx`

**Step 1: Create SectionRenderer**

Create `src/dashboard/SectionRenderer.tsx`:

```typescript
import type { DashboardSection } from './types'
import type { ILayer, ConverterRegistry } from '../types'
import { WidgetRenderer } from './WidgetRenderer'

interface Props {
  section: DashboardSection
  layers: Record<string, ILayer>
  registry: ConverterRegistry
  onNavigate?: (address: string) => void
}

const GRID_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 sm:grid-cols-2',
  3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
  4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
}

export function SectionRenderer({ section, layers, registry, onNavigate }: Props) {
  const gridClass = GRID_COLS[section.columnCount] || GRID_COLS[3]

  return (
    <div className="mb-6">
      <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-1">
        {section.title}
      </h2>
      <div className={`grid ${gridClass} gap-3`}>
        {section.widgets.map(widget => (
          <WidgetRenderer
            key={widget.id}
            widget={widget}
            layers={layers}
            registry={registry}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </div>
  )
}
```

**Step 2: Verify types compile**

Run: `cd /c/Users/lippe/Repos/ui.do && npx tsc --noEmit --pretty`
Expected: No errors

**Step 3: Commit**

```bash
git add src/dashboard/SectionRenderer.tsx
git commit -m "feat(dashboard): add SectionRenderer grid component"
```

---

### Task 5: Integrate Config-Driven Dashboard into DashboardView

Replace DashboardView rendering with the new section/widget config system when config exists. Keep backwards compatibility — if no dashboard config, show the original noun grid / index layer.

**Files:**
- Create: `src/dashboard/index.ts` (barrel export)
- Modify: `src/pages/DashboardView.tsx`

**Step 1: Create barrel export**

Create `src/dashboard/index.ts`:

```typescript
export { parseDashboardConfig, serializeSection, serializeWidget, serializeTarget } from './parser'
export type { DashboardConfig, DashboardSection, DashboardWidget, WidgetType } from './types'
export { WidgetRenderer } from './WidgetRenderer'
export { SectionRenderer } from './SectionRenderer'
```

**Step 2: Update DashboardView**

In `src/pages/DashboardView.tsx`:

1. Add imports:

```typescript
import { parseDashboardConfig, serializeSection, serializeWidget, SectionRenderer } from '../dashboard'
import type { DashboardConfig, WidgetType } from '../dashboard'
import { defaultRegistry } from '../components/converter'
```

2. Add state for layers and config (after line 65, existing state):

```typescript
const [layers, setLayers] = useState<Record<string, ILayer>>({})
const [dashboardConfig, setDashboardConfig] = useState<DashboardConfig | null>(null)
```

3. Replace the fetchLayers effect (lines 69-79) to also store raw layers:

```typescript
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
```

4. Add effect to parse config from prefs (after the Dashboard noun effect, around line 91):

```typescript
useEffect(() => {
  if (prefs.length === 0) { setDashboardConfig(null); return }
  const configFacts = prefs.filter(p => {
    const v = p.value || ''
    return v.startsWith('section ') || v.startsWith('widget ') || v.startsWith('targets ')
  })
  if (configFacts.length > 0) setDashboardConfig(parseDashboardConfig(configFacts))
  else setDashboardConfig(null)
}, [prefs])
```

5. In the render, update the non-editing branch (the `<>` block around line 170). Replace the simple `LayerRenderer` call with a conditional that uses `SectionRenderer` when config exists:

Change the `) : (` non-editing branch from:

```tsx
<>
  <LayerRenderer layer={displayLayer} onNavigate={handleLayerNavigate} />
  <button ...>Schema</button>
</>
```

To:

```tsx
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
```

**Step 3: Verify app builds**

Run: `cd /c/Users/lippe/Repos/ui.do && npx vite build`
Expected: Build succeeds

**Step 4: Commit**

```bash
git add src/dashboard/index.ts src/pages/DashboardView.tsx
git commit -m "feat(dashboard): integrate config-driven section rendering"
```

---

### Task 6: Edit Mode — Section and Widget CRUD

Extend edit mode with add/delete sections, add/delete widgets, and a step-by-step widget picker.

**Files:**
- Create: `src/dashboard/WidgetPicker.tsx`
- Modify: `src/pages/DashboardView.tsx`
- Modify: `src/dashboard/index.ts`

**Step 1: Create WidgetPicker component**

Create `src/dashboard/WidgetPicker.tsx`:

```typescript
import { useState } from 'react'
import type { ILayer, ILayerField } from '../types'
import type { WidgetType } from './types'
import type { Noun } from '../api'

interface Props {
  nouns: Noun[]
  layers: Record<string, ILayer>
  onSelect: (widgetType: WidgetType, entity: string, field?: string, layer?: string) => void
  onCancel: () => void
}

type Step = 'type' | 'entity' | 'field'

const WIDGET_TYPES: { type: WidgetType; label: string; description: string }[] = [
  { type: 'link', label: 'Entity Link', description: 'Navigate to entity list' },
  { type: 'field', label: 'Field Display', description: 'Show a specific field value' },
  { type: 'status-summary', label: 'Status Summary', description: 'Show status counts' },
  { type: 'submission', label: 'Submission Form', description: 'Inline form to create records' },
  { type: 'streaming', label: 'Streaming Feed', description: 'Live updates' },
  { type: 'remote-control', label: 'Remote Control', description: 'Control another widget' },
]

export function WidgetPicker({ nouns, layers, onSelect, onCancel }: Props) {
  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)

  const handleSelectType = (type: WidgetType) => {
    setSelectedType(type)
    setStep('entity')
  }

  const handleSelectEntity = (entityName: string) => {
    if (selectedType === 'link') {
      onSelect('link', entityName)
      return
    }
    setSelectedEntity(entityName)
    setStep('field')
  }

  // Find fields available for the selected entity
  const entityFields: ILayerField[] = []
  if (selectedEntity) {
    const lower = selectedEntity.toLowerCase()
    for (const [key, layer] of Object.entries(layers)) {
      if (!key.toLowerCase().startsWith(lower)) continue
      if (layer.type === 'formLayer') {
        for (const fs of layer.fieldsets) {
          entityFields.push(...fs.fields)
        }
      }
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {step === 'type' && 'Select Widget Type'}
          {step === 'entity' && 'Select Entity'}
          {step === 'field' && `Select Field from ${selectedEntity}`}
        </h3>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      {step === 'type' && (
        <div className="space-y-2">
          {WIDGET_TYPES.map(wt => (
            <button
              key={wt.type}
              onClick={() => handleSelectType(wt.type)}
              className="w-full text-left bg-background border border-border rounded-lg p-3 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
            >
              <div className="text-sm font-medium text-card-foreground">{wt.label}</div>
              <div className="text-xs text-muted-foreground">{wt.description}</div>
            </button>
          ))}
        </div>
      )}

      {step === 'entity' && (
        <div className="space-y-2">
          {nouns.map(n => (
            <button
              key={n.id}
              onClick={() => handleSelectEntity(n.name)}
              className="w-full text-left bg-background border border-border rounded-lg p-3 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
            >
              <div className="text-sm font-medium text-card-foreground">{n.name}</div>
            </button>
          ))}
        </div>
      )}

      {step === 'field' && (
        <div className="space-y-2">
          {entityFields.length > 0 ? (
            entityFields.map(f => (
              <button
                key={f.id}
                onClick={() => onSelect(selectedType!, selectedEntity!, f.id)}
                className="w-full text-left bg-background border border-border rounded-lg p-3 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                <div className="text-sm font-medium text-card-foreground">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.type}</div>
              </button>
            ))
          ) : (
            <div className="text-sm text-muted-foreground p-3">
              No fields found in generated layers.
              <button
                onClick={() => onSelect(selectedType!, selectedEntity!)}
                className="block mt-2 text-primary-600 hover:underline"
              >
                Add without field reference
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

**Step 2: Add WidgetPicker to barrel export**

In `src/dashboard/index.ts`, add:

```typescript
export { WidgetPicker } from './WidgetPicker'
```

**Step 3: Add section/widget CRUD to DashboardView edit mode**

In `src/pages/DashboardView.tsx`:

Add imports:
```typescript
import { WidgetPicker } from '../dashboard/WidgetPicker'
```

Add state:
```typescript
const [pickingWidgetForSection, setPickingWidgetForSection] = useState<string | null>(null)
```

Add handlers:

```typescript
const handleAddSection = useCallback(async (title: string) => {
  if (!dashboardNoun) return
  const position = dashboardConfig ? dashboardConfig.sections.length : 0
  const value = serializeSection(title, position)
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
```

Replace the edit mode content (the `editing ? (` block, lines 144-169) with:

```tsx
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
)}
```

**Step 4: Verify app builds**

Run: `cd /c/Users/lippe/Repos/ui.do && npx vite build`
Expected: Build succeeds

**Step 5: Commit**

```bash
git add src/dashboard/WidgetPicker.tsx src/dashboard/index.ts src/pages/DashboardView.tsx
git commit -m "feat(dashboard): add section/widget CRUD and widget picker in edit mode"
```

---

### Task 7: Manual E2E Test

Verify the full dashboard customization flow works in the browser.

**Step 1: Start dev server**

Run: `cd /c/Users/lippe/Repos/ui.do && yarn dev`

**Step 2: Open test app**

Navigate to `http://localhost:5173/?app=pet-tracker-e2e`

**Step 3: Verify existing behavior**

- Dashboard shows generated index layer or noun grid fallback
- "Edit Dashboard" button appears if Dashboard noun exists
- Pin/hide still work

**Step 4: Test section creation**

1. Click "Edit Dashboard"
2. Scroll to "Dashboard Sections"
3. Click "+ Add Section", enter "Overview"
4. Click "+ Add Section", enter "Quick Actions"

**Step 5: Test widget addition**

1. In "Overview", click "+ Add Widget"
2. Select "Entity Link" → select "Pet"
3. In "Overview", click "+ Add Widget" again
4. Select "Field Display" → select entity → select field

**Step 6: Test rendering**

1. Click "Done" to exit edit mode
2. Verify sections render with widgets in a responsive grid
3. Verify entity link widgets navigate correctly

**Step 7: Test deletion**

1. Re-enter edit mode
2. Delete a widget (x button)
3. Delete a section (Delete button) — all its widgets should disappear too

**Step 8: Commit any fixes**

```bash
git add -A
git commit -m "fix(dashboard): address issues found during manual testing"
```

---

### Task 8: Deploy

**Step 1: Build**

Run: `cd /c/Users/lippe/Repos/ui.do && yarn build`
Expected: Build succeeds with no errors

**Step 2: Deploy**

Deploy per ui.do's usual Cloudflare Pages method.

**Step 3: Verify in production**

Navigate to `https://ui.auto.dev/?app=pet-tracker-e2e` and test the basic section/widget flow.
