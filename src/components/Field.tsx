import type { ILayerField, ConverterRegistry } from '../types'
import { resolveControl } from './converter'

export function Field({ field, registry }: { field: ILayerField; registry: ConverterRegistry }) {
  const Control = resolveControl(field.type, registry)
  return <Control field={field} />
}
