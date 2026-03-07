import { Markdown } from '../Markdown'
import type { ILayerField } from '../../types'

export function MarkdownControl({ field }: { field: ILayerField }) {
  const text = (field.value as string) || ''
  if (!text) return null
  return (
    <div className="mb-4">
      {field.label && <label className="block text-sm font-medium text-gray-500 mb-1">{field.label}</label>}
      <div className="text-sm text-gray-900"><Markdown>{text}</Markdown></div>
    </div>
  )
}
