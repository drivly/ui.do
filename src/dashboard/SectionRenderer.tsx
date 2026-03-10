import type { DashboardSection } from './types.ts'
import type { ILayer, ConverterRegistry } from '../types.ts'
import { WidgetRenderer } from './WidgetRenderer.tsx'

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
