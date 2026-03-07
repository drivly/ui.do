import type { INavigationLayer, IActionButton, ConverterRegistry } from '../types'
import { ActionButton } from './ActionButton'

interface Props {
  layer: INavigationLayer
  registry: ConverterRegistry
  onAction?: (btn: IActionButton) => void
  onNavigate?: (address: string) => void
}

export function NavigationLayer({ layer, registry: _registry, onAction, onNavigate }: Props) {
  return (
    <div>
      {layer.items.map((list, i) => (
        <div key={i} className="space-y-2">
          {list.items.map((item, j) => (
            <button key={j}
              onClick={() => item.onClick ? item.onClick() : onNavigate?.(item.link?.address || item.address || '')}
              className="block w-full text-left bg-white border rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{item.text}</div>
                  {item.subtext && <div className="text-xs text-gray-500 mt-0.5">{item.subtext}</div>}
                </div>
                {item.status && (
                  <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border bg-gray-100 text-gray-500 border-gray-200">
                    {item.status}
                  </span>
                )}
              </div>
            </button>
          ))}
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
