import type { ILayerField } from '../types'
import { TextField } from './TextField'
import { BoolField } from './BoolField'
import { SelectField } from './SelectField'
import { DateField } from './DateField'
import { MultiLineField } from './MultiLineField'

export function Field({ field }: { field: ILayerField }) {
  switch (field.type) {
    case 'bool': return <BoolField field={field} />
    case 'select': return <SelectField field={field} />
    case 'date': return <DateField field={field} />
    case 'multiline': return <MultiLineField field={field} />
    default: return <TextField field={field} />
  }
}
