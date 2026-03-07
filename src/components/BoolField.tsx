import type { ILayerField } from '../types'

export function BoolField({ field }: { field: ILayerField }) {
  return (
    <div className="mb-4 flex items-center gap-3">
      <input type="checkbox" name={field.submitKey || field.id} defaultChecked={!!field.value}
        className="h-5 w-5 rounded border-input text-primary-600 focus:ring-ring" />
      <label className="text-sm font-medium text-card-foreground">{field.label}</label>
    </div>
  )
}
