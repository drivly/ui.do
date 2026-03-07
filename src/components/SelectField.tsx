import type { ILayerField } from '../types'

export function SelectField({ field }: { field: ILayerField }) {
  const name = field.submitKey || field.id
  const defaultVal = field.selectedIndex !== undefined
    ? field.options?.[field.selectedIndex]
    : field.value as string

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-card-foreground mb-1">{field.label}</label>
      <select name={name} defaultValue={defaultVal}
        className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring">
        <option value="">{field.placeholder || 'Select...'}</option>
        {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </div>
  )
}
