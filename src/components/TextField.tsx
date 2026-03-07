import type { ILayerField } from '../types'

export function TextField({ field }: { field: ILayerField }) {
  if (field.type === 'label') {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-500 mb-1">{field.label}</label>
        <div className="text-sm text-gray-900">{field.value as string}</div>
      </div>
    )
  }

  const inputType = field.type === 'email' ? 'email'
    : field.type === 'numeric' ? 'number'
    : field.type === 'password' ? 'password'
    : 'text'

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
      <input
        type={inputType}
        name={field.id}
        placeholder={field.placeholder}
        defaultValue={field.value as string}
        required={field.required}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
      />
    </div>
  )
}
