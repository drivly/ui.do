import type { IFormLayer, IActionButton } from '../types'
import { Fieldset } from './Fieldset'
import { ActionButton } from './ActionButton'
import { Link } from 'react-router-dom'

export function FormLayer({ layer, onAction }: { layer: IFormLayer, onAction: (btn: IActionButton) => void }) {
  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">{layer.title}</h1>
      <form onSubmit={e => e.preventDefault()} className="bg-white rounded-xl shadow-sm border p-6">
        {layer.fieldsets.map((fs, i) => <Fieldset key={i} fieldset={fs} />)}
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
              <Link key={i} to={nav.address || '#'}
                className="block p-3 bg-white rounded-lg border hover:border-blue-300 transition-colors">
                {nav.text}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
