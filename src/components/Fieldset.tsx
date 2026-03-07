import type { IFieldset, ConverterRegistry } from '../types'
import { Field } from './Field'

export function Fieldset({ fieldset, registry }: { fieldset: IFieldset; registry: ConverterRegistry }) {
  return (
    <fieldset className="mb-6">
      {fieldset.header && (
        <legend className="text-lg font-semibold text-gray-900 mb-3">{fieldset.header}</legend>
      )}
      {fieldset.fields.map(f => <Field key={f.id} field={f} registry={registry} />)}
      {fieldset.footer && (
        <p className="text-sm text-gray-500 mt-2">{fieldset.footer}</p>
      )}
    </fieldset>
  )
}
