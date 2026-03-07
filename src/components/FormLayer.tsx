import type { IFormLayer, IActionButton, ConverterRegistry } from '../types'
import { Fieldset } from './Fieldset'
import { ActionButton } from './ActionButton'

interface Props {
  layer: IFormLayer
  registry: ConverterRegistry
  onAction: (btn: IActionButton) => void
  onNavigate?: (address: string) => void
}

export function FormLayer({ layer, registry, onAction, onNavigate }: Props) {
  return (
    <div>
      <form onSubmit={e => e.preventDefault()} className="bg-white rounded-xl shadow-sm border p-6">
        {layer.fieldsets.map((fs, i) => <Fieldset key={i} fieldset={fs} registry={registry} />)}
        {layer.actionButtons?.length ? (
          <div className="flex gap-3 mt-6 pt-4 border-t">
            {layer.actionButtons.map(btn => (
              <ActionButton key={btn.id} button={btn} onAction={onAction} />
            ))}
          </div>
        ) : null}
      </form>
      {layer.navigation?.length ? (
        <div className="mt-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-3">Related</h2>
          <div className="space-y-2">
            {layer.navigation.map((nav, i) => (
              <button key={i} onClick={() => onNavigate?.(nav.address || '')}
                className="block w-full text-left p-3 bg-white rounded-lg border hover:border-blue-300 transition-colors text-sm text-gray-900">
                {nav.text}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
