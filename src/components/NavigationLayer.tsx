import { useState } from 'react'
import type { INavigationLayer, IActionButton, ILayerGridCell, ConverterRegistry } from '../types'
import { ActionButton } from './ActionButton'
import { Menu } from './Menu'
import { Toolbar } from './Toolbar'
import { formatNounName } from '../utils'

// ---------------------------------------------------------------------------
// GridCellRenderer — maps ILayerGridCell to CSS Grid
// ---------------------------------------------------------------------------

const STYLE_CLASSES: Record<string, string> = {
  primary: 'text-sm font-medium text-card-foreground truncate',
  secondary: 'text-xs text-muted-foreground',
  muted: 'text-xs text-muted-foreground',
  date: 'text-xs text-muted-foreground whitespace-nowrap',
  status: 'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border',
  label: 'text-sm text-card-foreground',
}

const ALIGNMENT_MAP: Record<string, string> = {
  start: 'justify-self-start',
  center: 'justify-self-center',
  end: 'justify-self-end',
  stretch: 'justify-self-stretch',
}

function GridCellRenderer({ grid, status }: { grid: ILayerGridCell; status?: string }) {
  return (
    <div className="w-full">
      <div className="flex items-start justify-between gap-3">
        <div
          className="flex-1 min-w-0 gap-x-3 gap-y-0.5"
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${grid.columns}, minmax(0, auto))`,
            gridTemplateRows: `repeat(${grid.rows}, auto)`,
          }}
        >
          {grid.elements.map((el, i) => {
            const value = (el as any).value ?? ''
            if (!value) return null
            const styleClass = STYLE_CLASSES[el.style || 'label'] || STYLE_CLASSES.label
            const alignClass = ALIGNMENT_MAP[el.horizontalAlignment || 'start'] || ''
            return (
              <span
                key={el.field + i}
                className={`${styleClass} ${alignClass}`}
                style={{
                  gridColumn: el.columnSpan ? `${el.column + 1} / span ${el.columnSpan}` : el.column + 1,
                  gridRow: el.rowSpan ? `${el.row + 1} / span ${el.rowSpan}` : el.row + 1,
                }}
              >
                {value}
              </span>
            )
          })}
        </div>
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0 mt-0.5"><path d="m9 18 6-6-6-6"/></svg>
      </div>
      {status && (
        <div className="flex justify-end mt-1">
          <span className={STYLE_CLASSES.status}>{status}</span>
        </div>
      )}
    </div>
  )
}

/** Returns true if the string is a template variable like {fieldId} */
function isTemplateText(s: string): boolean {
  return /^\{[a-zA-Z_]\w*\}$/.test(s.trim())
}

interface Props {
  layer: INavigationLayer
  registry: ConverterRegistry
  onAction?: (btn: IActionButton) => void
  onNavigate?: (address: string) => void
  selectedId?: string | null
  /** Hide the built-in search box (when rendered externally) */
  hideSearchBox?: boolean
  /** Externally controlled search text */
  externalSearchText?: string
}

export function NavigationLayer({ layer, registry: _registry, onAction, onNavigate, selectedId, hideSearchBox, externalSearchText }: Props) {
  const [internalSearchText, setInternalSearchText] = useState(layer.searchBox?.text || '')
  const searchText = externalSearchText ?? internalSearchText

  // Filter items by search text if search box is present
  const filteredItems = layer.searchBox
    ? layer.items.map(list => ({
        ...list,
        items: list.items.filter(item => {
          const q = searchText.toLowerCase()
          return !q || item.text.toLowerCase().includes(q) || item.subtext?.toLowerCase().includes(q)
        }),
      })).filter(list => list.items.length > 0)
    : layer.items

  return (
    <div>
      {layer.menu && <Menu menu={layer.menu} onNavigate={onNavigate} />}
      {layer.toolbar && <Toolbar toolbar={layer.toolbar} onNavigate={onNavigate} />}

      {layer.searchBox && !hideSearchBox && (
        <div className="mb-4 flex items-center gap-2">
          <input
            type="search"
            placeholder={layer.searchBox.placeholder || 'Search...'}
            value={internalSearchText}
            onChange={e => setInternalSearchText(e.target.value)}
            className="flex-1 px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
          {onAction && layer.actionButtons?.map((btn, i) => (
            <button
              key={i}
              onClick={() => onAction(btn)}
              title={formatNounName(btn.text)}
              className="flex-shrink-0 p-2 border border-input rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14"/><path d="M12 5v14"/></svg>
            </button>
          ))}
        </div>
      )}

      {filteredItems.map((list, i) => (
        <div key={i} className="space-y-2 mb-4">
          {list.header && (
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">{list.header}</h3>
          )}
          {list.items.map((item, j) => {
            const itemAddress = item.link?.address || item.address || ''
            const itemId = itemAddress.split('/').pop()
            const isSelected = selectedId && itemId === selectedId
            return (
            <button key={j}
              onClick={() => item.onClick ? item.onClick() : onNavigate?.(itemAddress)}
              className={`block w-full text-left rounded-lg p-4 transition-all border ${
                isSelected
                  ? 'bg-primary-600/10 border-primary-500 ring-1 ring-primary-500 dark:bg-primary-400/10 dark:border-primary-400 dark:ring-primary-400'
                  : 'bg-card border-border hover:border-primary-300 dark:hover:border-primary-700 hover:shadow-sm'
              }`}>
              {item.grid ? (
                <GridCellRenderer grid={item.grid} status={item.status} />
              ) : (
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      {item.imagePath && (
                        <img src={item.imagePath} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-card-foreground truncate">{item.text}</span>
                          {item.date && <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">{item.date}</span>}
                        </div>
                        {item.subtext && !isTemplateText(item.subtext) && <div className="text-xs text-muted-foreground mt-0.5">{item.subtext}</div>}
                      </div>
                    </div>
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0 mt-0.5"><path d="m9 18 6-6-6-6"/></svg>
                  </div>
                  {item.status && (
                    <div className="flex justify-end mt-1">
                      <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                        {item.status}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </button>
            )
          })}
          {list.footer && (
            <p className="text-xs text-muted-foreground px-1">{list.footer}</p>
          )}
          {!list.footer && list.items.length > 0 && (
            <p className="text-xs text-muted-foreground px-1 text-center pt-1">{list.items.length} {list.items.length === 1 ? 'item' : 'items'}</p>
          )}
        </div>
      ))}

      {onAction && !layer.searchBox && layer.actionButtons?.length ? (
        <div className="mt-4 flex gap-2">
          {layer.actionButtons.map((btn, i) => (
            <ActionButton key={i} button={btn} onAction={onAction} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
