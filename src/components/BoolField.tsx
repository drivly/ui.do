import type { ILayerField } from '../types'

export function BoolField({ field }: { field: ILayerField }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <input type="checkbox" name={field.id} defaultChecked={!!field.value}
        className="h-5 w-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
      <label className="text-sm font-medium text-gray-700">{field.label}</label>
    </div>
  )
}
