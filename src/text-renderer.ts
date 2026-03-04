import type { IFormLayer, INavigationLayer, ILayer, IFieldset, ILayerField, IActionButton, INavigationItem } from './types'

function renderField(field: ILayerField): string {
  const req = field.required ? ', required' : ''

  switch (field.type) {
    case 'bool':
      return field.value ? `- [x] ${field.label}` : `- [ ] ${field.label}`
    case 'label':
      return `- ${field.label}${field.value != null ? `: ${field.value}` : ''}`
    case 'select':
      if (field.value != null) {
        return `- ${field.label}: ${field.value} [select: ${(field.options ?? []).join(', ')}]`
      }
      return `- ${field.label}: [select${req}: ${(field.options ?? []).join(', ')}]`
    default: {
      if (field.value != null) {
        return `- ${field.label}: ${field.value} [${field.type}]`
      }
      const ph = field.placeholder ? `, "${field.placeholder}"` : ''
      return `- ${field.label}: [${field.type}${req}${ph}]`
    }
  }
}

function renderFieldset(fieldset: IFieldset): string {
  const lines: string[] = []
  if (fieldset.header) lines.push(`## ${fieldset.header}`)
  for (const field of fieldset.fields) {
    lines.push(renderField(field))
  }
  if (fieldset.footer) lines.push(`_${fieldset.footer}_`)
  return lines.join('\n')
}

function renderActions(buttons: IActionButton[]): string {
  const lines = ['## Actions']
  buttons.forEach((btn, i) => {
    const event = btn.address ? btn.address.split('/').pop() : btn.action ?? btn.id
    lines.push(`${i + 1}. ${event} - ${btn.text}`)
  })
  return lines.join('\n')
}

function renderNavigation(items: INavigationItem[]): string {
  const lines = ['## Related']
  for (const item of items) {
    const addr = item.address ?? item.link?.address ?? ''
    lines.push(`- ${addr} → ${item.text}`)
  }
  return lines.join('\n')
}

export function renderFormLayerAsText(layer: IFormLayer): string {
  const sections: string[] = [`# ${layer.title}`]

  for (const fieldset of layer.fieldsets) {
    sections.push(renderFieldset(fieldset))
  }

  if (layer.actionButtons?.length) {
    sections.push(renderActions(layer.actionButtons))
  }

  if (layer.navigation?.length) {
    sections.push(renderNavigation(layer.navigation))
  }

  return sections.join('\n\n')
}

export function renderNavigationLayerAsText(layer: INavigationLayer): string {
  const sections: string[] = [`# ${layer.title}`]

  for (const list of layer.items) {
    const lines: string[] = []
    for (const item of list.items) {
      const addr = item.address ?? item.link?.address ?? ''
      const sub = item.subtext ? ` - ${item.subtext}` : ''
      lines.push(`- ${addr} → ${item.text}${sub}`)
    }
    sections.push(lines.join('\n'))
  }

  return sections.join('\n\n')
}

export function renderLayerAsText(layer: ILayer): string {
  if (layer.type === 'formLayer') return renderFormLayerAsText(layer)
  if (layer.type === 'layer') return renderNavigationLayerAsText(layer)
  return `# ${(layer as ILayer).title}\n\n(Unknown layer type)`
}
