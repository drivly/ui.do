import type { IFieldset } from '../types'
import { Field } from './Field'

export function Fieldset({ fieldset }: { fieldset: IFieldset }) {
  return (
    <fieldset className="mb-6">
      {fieldset.header && (
        <legend className="text-lg font-semibold text-gray-900 mb-3">{fieldset.header}</legend>
      )}
      {fieldset.fields.map(f => <Field key={f.id} field={f} />)}
      {fieldset.footer && (
        <p className="text-sm text-gray-500 mt-2">{fieldset.footer}</p>
      )}
    </fieldset>
  )
}
