import type { ILayerField } from '../types'

/** A field that displays an image or image picker placeholder */
export function ImageField({ field }: { field: ILayerField }) {
  const src = field.imagePath || (field.value as string) || ''
  const stretch = field.stretch || 'uniform'

  const objectFit = stretch === 'fill' ? 'cover'
    : stretch === 'uniform' ? 'contain'
    : 'none'

  return (
    <div className="mb-4">
      {field.label && (
        <label className="block text-sm font-medium text-card-foreground mb-1">{field.label}</label>
      )}
      {src ? (
        <img
          src={src}
          alt={field.label}
          className="rounded-lg border border-border max-w-full"
          style={{ objectFit, maxHeight: 300 }}
        />
      ) : (
        <div className="flex items-center justify-center h-32 rounded-lg border-2 border-dashed border-border bg-muted text-muted-foreground text-sm">
          No image
        </div>
      )}
    </div>
  )
}
