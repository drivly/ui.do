import type { ControlComponent, ConverterRegistry } from '../types'
import { TextField } from './TextField'
import { SelectField } from './SelectField'
import { BoolField } from './BoolField'
import { DateField } from './DateField'
import { MultiLineField } from './MultiLineField'
import { ChatControl } from './controls/ChatControl'
import { MarkdownControl } from './controls/MarkdownControl'
import { StatusControl } from './controls/StatusControl'

export const defaultRegistry: ConverterRegistry = {
  text: TextField,
  email: TextField,
  numeric: TextField,
  password: TextField,
  label: TextField,
  slider: TextField,
  select: SelectField,
  bool: BoolField,
  date: DateField,
  multiline: MultiLineField,
  chat: ChatControl,
  markdown: MarkdownControl,
  status: StatusControl,
}

export function mergeRegistry(overrides?: Partial<ConverterRegistry>): ConverterRegistry {
  if (!overrides) return defaultRegistry
  const merged = { ...defaultRegistry }
  for (const [key, val] of Object.entries(overrides)) {
    if (val) merged[key] = val
  }
  return merged
}

export function resolveControl(type: string, registry: ConverterRegistry): ControlComponent {
  return registry[type] || registry.text
}
