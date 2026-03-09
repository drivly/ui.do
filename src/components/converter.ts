import type { ControlComponent, ConverterRegistry } from '../types'
import { TextField } from './TextField'
import { SelectField } from './SelectField'
import { BoolField } from './BoolField'
import { DateField } from './DateField'
import { TimeField } from './TimeField'
import { MultiLineField } from './MultiLineField'
import { SliderField } from './SliderField'
import { NavigationField } from './NavigationField'
import { ButtonField } from './ButtonField'
import { ImageField } from './ImageField'
import { ChatControl } from './controls/ChatControl'
import { ChatStreamControl } from './controls/ChatStreamControl'
import { MarkdownControl } from './controls/MarkdownControl'
import { StatusControl } from './controls/StatusControl'

export const defaultRegistry: ConverterRegistry = {
  // Text variants (all use TextField with input type switching)
  text: TextField,
  email: TextField,
  numeric: TextField,
  password: TextField,
  label: TextField,

  // Rich input controls
  multiline: MultiLineField,
  select: SelectField,
  bool: BoolField,
  date: DateField,
  time: TimeField,
  slider: SliderField,

  // Interactive fields
  navigation: NavigationField,
  button: ButtonField,
  image: ImageField,

  // Extended controls (ui.do specific)
  chat: ChatControl,
  'chat-stream': ChatStreamControl,
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
