import type { ILayerField } from '../types'
import { useNavigate } from './NavigationContext'

/** A field that renders as a clickable button within a form */
export function ButtonField({ field }: { field: ILayerField }) {
  const navigate = useNavigate()
  const address = field.link?.address || ''

  return (
    <div className="mb-4">
      <button
        type="button"
        onClick={() => address && navigate(address)}
        className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
      >
        {field.label}
      </button>
    </div>
  )
}
