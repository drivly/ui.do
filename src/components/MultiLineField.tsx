import type { ILayerField } from '../types'

export function MultiLineField({ field }: { field: ILayerField }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
      <textarea name={field.id} placeholder={field.placeholder} rows={4}
        defaultValue={field.value as string}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" />
    </div>
  )
}
