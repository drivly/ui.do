import { useMemo } from 'react'
import type { ILayer, IActionButton, ConverterRegistry } from '../types'
import { FormLayer } from './FormLayer'
import { NavigationLayer } from './NavigationLayer'
import { mergeRegistry } from './converter'
import { NavigationProvider } from './NavigationContext'

interface Props {
  layer: ILayer
  converters?: Partial<ConverterRegistry>
  onAction?: (btn: IActionButton) => void
  onNavigate?: (address: string) => void
  selectedId?: string | null
  hideSearchBox?: boolean
  externalSearchText?: string
}

export function LayerRenderer({ layer, converters, onAction, onNavigate, selectedId, hideSearchBox, externalSearchText }: Props) {
  const registry = useMemo(() => mergeRegistry(converters), [converters])
  const handleAction = onAction || (() => {})
  const handleNavigate = onNavigate || (() => {})

  return (
    <NavigationProvider value={handleNavigate}>
      {layer.type === 'formLayer' ? (
        <FormLayer layer={layer} registry={registry} onAction={handleAction} onNavigate={handleNavigate} />
      ) : (
        <NavigationLayer layer={layer} registry={registry} onAction={handleAction} onNavigate={handleNavigate} selectedId={selectedId} hideSearchBox={hideSearchBox} externalSearchText={externalSearchText} />
      )}
    </NavigationProvider>
  )
}
