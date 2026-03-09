import type { DashboardWidget } from './types.ts'
import type { ILayer, ILayerField, IFormLayer, INavigationLayer, ConverterRegistry } from '../types.ts'
import { resolveControl } from '../components/converter.ts'
import { NavigationProvider } from '../components/NavigationContext.tsx'

interface Props {
  widget: DashboardWidget
  layers: Record<string, ILayer>
  registry: ConverterRegistry
  onNavigate?: (address: string) => void
}

/**
 * Resolve the ILayerField that a widget should render.
 *
 * Strategy:
 *  1. If widget.layer is set, use it as a key into the layers map.
 *     Otherwise, find the first layer whose key starts with the entity name (lowercased).
 *  2. For formLayers — search fieldsets for a field matching widget.field (by id or label).
 *  3. For navigationLayers ('layer') — convert matching list items into a synthetic ILayerField.
 *  4. If no field is specified on the widget — return a synthetic navigation field for the entity.
 *  5. Return null if nothing matches.
 */
function resolveWidgetField(widget: DashboardWidget, layers: Record<string, ILayer>): ILayerField | null {
  const entityLower = widget.entity.toLowerCase()

  // 1. Find the target layer
  let layer: ILayer | undefined
  if (widget.layer && layers[widget.layer]) {
    layer = layers[widget.layer]
  } else {
    // Match by entity name prefix
    const key = Object.keys(layers).find(k => k.toLowerCase().startsWith(entityLower))
    if (key) layer = layers[key]
  }

  if (!layer) {
    // No layer found — if no specific field requested, return a synthetic navigation field
    if (!widget.field) {
      return {
        id: `${entityLower}-nav`,
        label: widget.entity,
        type: 'navigation',
        link: { address: `/${entityLower}` },
      }
    }
    return null
  }

  // 2. formLayer — search fieldsets
  if (layer.type === 'formLayer') {
    const formLayer = layer as IFormLayer
    if (widget.field) {
      for (const fieldset of formLayer.fieldsets) {
        const match = fieldset.fields.find(
          f => f.id === widget.field || f.label.toLowerCase() === widget.field!.toLowerCase()
        )
        if (match) return match
      }
      return null
    }
    // No field specified — return first field as a fallback
    if (formLayer.fieldsets.length > 0 && formLayer.fieldsets[0].fields.length > 0) {
      return formLayer.fieldsets[0].fields[0]
    }
    return null
  }

  // 3. navigationLayer ('layer') — convert list items to synthetic ILayerField
  if (layer.type === 'layer') {
    const navLayer = layer as INavigationLayer
    if (widget.field) {
      for (const list of navLayer.items) {
        const item = list.items.find(
          i => i.text.toLowerCase() === widget.field!.toLowerCase()
        )
        if (item) {
          return {
            id: widget.field,
            label: item.text,
            type: 'navigation',
            value: item.subtext || item.text,
            link: item.link || (item.address ? { address: item.address } : undefined),
          }
        }
      }
      return null
    }
    // No field specified — return a synthetic navigation field listing entity items
    const allItems = navLayer.items.flatMap(l => l.items)
    if (allItems.length > 0) {
      const first = allItems[0]
      return {
        id: `${entityLower}-nav`,
        label: widget.entity,
        type: 'navigation',
        value: `${allItems.length} items`,
        link: first.link || (first.address ? { address: first.address } : undefined),
      }
    }
    return {
      id: `${entityLower}-nav`,
      label: widget.entity,
      type: 'navigation',
      link: { address: `/${entityLower}` },
    }
  }

  return null
}

export function WidgetRenderer({ widget, layers, registry, onNavigate }: Props) {
  const handleNavigate = onNavigate ?? (() => {})

  // --- Streaming widget: render ChatStreamControl ---
  if (widget.widgetType === 'streaming') {
    const syntheticField: ILayerField = {
      id: widget.id,
      label: widget.entity,
      type: 'chat-stream',
      placeholder: `Chat with ${widget.entity}...`,
      link: widget.field ? { address: widget.field } : undefined,
    }
    const Control = registry['chat-stream'] || registry['chat']
    if (Control) {
      return (
        <NavigationProvider value={handleNavigate}>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <Control field={syntheticField} />
          </div>
        </NavigationProvider>
      )
    }
  }

  // --- Link widget: simple clickable card ---
  if (widget.widgetType === 'link') {
    return (
      <NavigationProvider value={handleNavigate}>
        <button
          type="button"
          onClick={() => handleNavigate(`/${widget.entity.toLowerCase()}`)}
          className="w-full bg-card border border-border rounded-xl p-4 text-left hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm transition-all"
        >
          <div className="text-sm font-medium text-card-foreground">{widget.entity}</div>
          <div className="text-xs text-muted-foreground mt-1">View all</div>
        </button>
      </NavigationProvider>
    )
  }

  // --- All other types: resolve the field from layers ---
  const field = resolveWidgetField(widget, layers)

  if (!field) {
    return (
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-sm text-destructive">(field not found)</div>
        <div className="text-xs text-muted-foreground mt-1">
          {widget.entity}{widget.field ? ` / ${widget.field}` : ''}
        </div>
      </div>
    )
  }

  const Control = resolveControl(field.type, registry)

  // --- Status-summary: wrap with entity label ---
  if (widget.widgetType === 'status-summary') {
    return (
      <NavigationProvider value={handleNavigate}>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">{widget.entity}</div>
          <Control field={field} />
        </div>
      </NavigationProvider>
    )
  }

  // --- Submission: wrap with "New {entity}" label ---
  if (widget.widgetType === 'submission') {
    return (
      <NavigationProvider value={handleNavigate}>
        <div className="bg-card border border-border rounded-xl p-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">New {widget.entity}</div>
          <Control field={field} />
        </div>
      </NavigationProvider>
    )
  }

  // --- Default: wrap with entity label ---
  return (
    <NavigationProvider value={handleNavigate}>
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="text-xs font-medium text-muted-foreground mb-2">{widget.entity}</div>
        <Control field={field} />
      </div>
    </NavigationProvider>
  )
}
