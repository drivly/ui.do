import type { ILayerField } from '../types'

export function TextField({ field }: { field: ILayerField }) {
  const name = field.submitKey || field.id
  const hasBrokenRules = field.brokenRules && field.brokenRules.length > 0

  if (field.type === 'label') {
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-foreground mb-1">{field.label}</label>
        <div className="text-sm text-foreground">{field.value as string}</div>
      </div>
    )
  }

  const inputType = field.type === 'email' ? 'email'
    : field.type === 'numeric' ? 'number'
    : field.type === 'password' ? 'password'
    : 'text'

  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-card-foreground mb-1">{field.label}</label>
      <input
        type={inputType}
        name={name}
        placeholder={field.placeholder}
        defaultValue={field.value as string}
        required={field.required}
        pattern={field.expression}
        className={`w-full px-3 py-2 border rounded-lg bg-background text-foreground focus:ring-2 focus:ring-ring focus:border-transparent ${
          hasBrokenRules ? 'border-destructive' : 'border-input'
        }`}
      />
      {hasBrokenRules && (
        <div className="mt-1 space-y-0.5">
          {field.brokenRules!.map((err, i) => (
            <p key={i} className="text-xs text-destructive">{err}</p>
          ))}
        </div>
      )}
    </div>
  )
}
