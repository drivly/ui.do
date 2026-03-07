import type { ILayerField } from '../types'

export function SliderField({ field }: { field: ILayerField }) {
  const min = field.minValue ?? 0
  const max = field.maxValue ?? 100
  const val = typeof field.value === 'number' ? field.value : min

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-card-foreground mb-1">
        {field.label}
        <span className="ml-2 text-muted-foreground">{val}</span>
      </label>
      <input
        type="range"
        name={field.submitKey || field.id}
        min={min}
        max={max}
        defaultValue={val}
        className="w-full accent-primary-600"
      />
    </div>
  )
}
