import type { ILayerField } from '../types'

export function MultiLineField({ field }: { field: ILayerField }) {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-card-foreground mb-1">{field.label}</label>
      <textarea name={field.submitKey || field.id} placeholder={field.placeholder} rows={4}
        defaultValue={field.value as string}
        className="w-full px-3 py-2 border border-input rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring" />
    </div>
  )
}
