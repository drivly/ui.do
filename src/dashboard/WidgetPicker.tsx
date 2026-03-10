import { useState } from 'react'
import type { ILayer, ILayerField } from '../types'
import type { WidgetType } from './types'
import type { Noun } from '../api'

interface Props {
  nouns: Noun[]
  layers: Record<string, ILayer>
  onSelect: (widgetType: WidgetType, entity: string, field?: string, layer?: string) => void
  onCancel: () => void
}

type Step = 'type' | 'entity' | 'field'

const WIDGET_TYPES: { type: WidgetType; label: string; description: string }[] = [
  { type: 'link', label: 'Entity Link', description: 'Navigate to entity list' },
  { type: 'field', label: 'Field Display', description: 'Show a specific field value' },
  { type: 'status-summary', label: 'Status Summary', description: 'Show status counts' },
  { type: 'submission', label: 'Submission Form', description: 'Inline form to create records' },
  { type: 'streaming', label: 'Streaming Feed', description: 'Live updates' },
  { type: 'remote-control', label: 'Remote Control', description: 'Control another widget' },
]

export function WidgetPicker({ nouns, layers, onSelect, onCancel }: Props) {
  const [step, setStep] = useState<Step>('type')
  const [selectedType, setSelectedType] = useState<WidgetType | null>(null)
  const [selectedEntity, setSelectedEntity] = useState<string | null>(null)

  const handleSelectType = (type: WidgetType) => {
    setSelectedType(type)
    setStep('entity')
  }

  const handleSelectEntity = (entityName: string) => {
    if (selectedType === 'link') {
      onSelect('link', entityName)
      return
    }
    setSelectedEntity(entityName)
    setStep('field')
  }

  const entityFields: ILayerField[] = []
  if (selectedEntity) {
    const lower = selectedEntity.toLowerCase()
    for (const [key, layer] of Object.entries(layers)) {
      if (!key.toLowerCase().startsWith(lower)) continue
      if (layer.type === 'formLayer') {
        for (const fs of layer.fieldsets) {
          entityFields.push(...fs.fields)
        }
      }
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-foreground">
          {step === 'type' && 'Select Widget Type'}
          {step === 'entity' && 'Select Entity'}
          {step === 'field' && `Select Field from ${selectedEntity}`}
        </h3>
        <button onClick={onCancel} className="text-xs text-muted-foreground hover:text-foreground">Cancel</button>
      </div>

      {step === 'type' && (
        <div className="space-y-2">
          {WIDGET_TYPES.map(wt => (
            <button
              key={wt.type}
              onClick={() => handleSelectType(wt.type)}
              className="w-full text-left bg-background border border-border rounded-lg p-3 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
            >
              <div className="text-sm font-medium text-card-foreground">{wt.label}</div>
              <div className="text-xs text-muted-foreground">{wt.description}</div>
            </button>
          ))}
        </div>
      )}

      {step === 'entity' && (
        <div className="space-y-2">
          {nouns.map(n => (
            <button
              key={n.id}
              onClick={() => handleSelectEntity(n.name)}
              className="w-full text-left bg-background border border-border rounded-lg p-3 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
            >
              <div className="text-sm font-medium text-card-foreground">{n.name}</div>
            </button>
          ))}
        </div>
      )}

      {step === 'field' && (
        <div className="space-y-2">
          {entityFields.length > 0 ? (
            entityFields.map(f => (
              <button
                key={f.id}
                onClick={() => onSelect(selectedType!, selectedEntity!, f.id)}
                className="w-full text-left bg-background border border-border rounded-lg p-3 hover:border-primary-300 dark:hover:border-primary-700 transition-all"
              >
                <div className="text-sm font-medium text-card-foreground">{f.label}</div>
                <div className="text-xs text-muted-foreground">{f.type}</div>
              </button>
            ))
          ) : (
            <div className="text-sm text-muted-foreground p-3">
              No fields found in generated layers.
              <button
                onClick={() => onSelect(selectedType!, selectedEntity!)}
                className="block mt-2 text-primary-600 hover:underline"
              >
                Add without field reference
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
