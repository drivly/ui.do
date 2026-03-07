import { Markdown } from '../Markdown'
import type { ILayerField } from '../../types'

export function MarkdownControl({ field }: { field: ILayerField }) {
  const text = (field.value as string) || ''
  if (!text) return null
  return (
    <div className="mb-4">
      {field.label && <label className="block text-sm font-medium text-muted-foreground mb-1">{field.label}</label>}
      <div className="text-sm text-foreground"><Markdown>{text}</Markdown></div>
    </div>
  )
}
