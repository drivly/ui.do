import { useMemo } from 'react'
import type { ILayer, IActionButton, ConverterRegistry } from '../types'
import { FormLayer } from './FormLayer'
import { NavigationLayer } from './NavigationLayer'
import { mergeRegistry } from './converter'

interface Props {
  layer: ILayer
  converters?: Partial<ConverterRegistry>
  onAction?: (btn: IActionButton) => void
  onNavigate?: (address: string) => void
}

export function LayerRenderer({ layer, converters, onAction, onNavigate }: Props) {
  const registry = useMemo(() => mergeRegistry(converters), [converters])
  const handleAction = onAction || (() => {})

  if (layer.type === 'formLayer') {
    return <FormLayer layer={layer} registry={registry} onAction={handleAction} onNavigate={onNavigate} />
  }

  return <NavigationLayer layer={layer} registry={registry} onAction={handleAction} onNavigate={onNavigate} />
}
