import type { ILayerField } from '../types'

export function TextField({ field }: { field: ILayerField }) {
  const name = field.submitKey || field.id
  const hasBrokenRules = field.brokenRules && field.brokenRules.length > 0

  if (field.type === 'label') {
    const val = field.value as string
    const hasValue = val && !/^\{[a-zA-Z_]\w*\}$/.test(val.trim())
    return (
      <div className="mb-4">
        <label className="block text-sm font-medium text-muted-foreground mb-1">{field.label}</label>
        {hasValue ? (
          <div className="text-sm text-foreground">{val}</div>
        ) : (
          <div className="text-sm text-muted-foreground/50">&mdash;</div>
        )}
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
