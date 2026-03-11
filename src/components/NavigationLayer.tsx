import { useState } from 'react'
import type { INavigationLayer, IActionButton, ConverterRegistry } from '../types'
import { ActionButton } from './ActionButton'
import { Menu } from './Menu'
import { Toolbar } from './Toolbar'

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
}

export function NavigationLayer({ layer, registry: _registry, onAction, onNavigate, selectedId }: Props) {
  const [searchText, setSearchText] = useState(layer.searchBox?.text || '')

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

      {layer.searchBox && (
        <div className="mb-4">
          <input
            type="search"
            placeholder={layer.searchBox.placeholder || 'Search...'}
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
          />
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
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {item.imagePath && (
                    <img src={item.imagePath} alt="" className="w-8 h-8 rounded object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-card-foreground truncate">{item.text}</div>
                    {item.subtext && !isTemplateText(item.subtext) && <div className="text-xs text-muted-foreground mt-0.5">{item.subtext}</div>}
                  </div>
                </div>
                {item.status ? (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-muted text-muted-foreground border-border">
                    {item.status}
                  </span>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground flex-shrink-0"><path d="m9 18 6-6-6-6"/></svg>
                )}
              </div>
            </button>
            )
          })}
          {list.footer && (
            <p className="text-xs text-muted-foreground px-1">{list.footer}</p>
          )}
        </div>
      ))}

      {onAction && layer.actionButtons?.length ? (
        <div className="mt-4 flex gap-2">
          {layer.actionButtons.map((btn, i) => (
            <ActionButton key={i} button={btn} onAction={onAction} />
          ))}
        </div>
      ) : null}
    </div>
  )
}
